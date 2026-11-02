const { app, BrowserWindow, ipcMain, dialog, session } = require("electron");
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const { validateUrl, normalizeOptions, isYtDlpVersionSafe, buildArgs } = require("./security");

const activeProcesses = new Map();
const approvedOutputDirs = new Map();
const INFO_TIMEOUT_MS = 45000;

function isTrustedSender(event) {
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender.mainFrame) return false;
  try {
    const url = new URL(frame.url);
    return url.protocol === "file:" && path.resolve(decodeURIComponent(url.pathname)) === path.resolve(__dirname, "index.html");
  } catch { return false; }
}
function assertTrustedSender(event) {
  if (!isTrustedSender(event)) throw new Error("拒絕來自非信任頁面的 IPC 請求。");
}
function sendTo(sender, channel, payload) {
  if (!sender.isDestroyed()) sender.send(channel, payload);
}
function runCommand(command, args, timeout = 15000) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) { error.stdout = stdout; error.stderr = stderr; reject(error); }
      else resolve({ stdout, stderr });
    });
  });
}
function duration(seconds) {
  if (!Number.isFinite(seconds)) return "";
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = Math.floor(seconds % 60);
  return h ? h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0")
    : m + ":" + String(s).padStart(2, "0");
}
function progress(line) {
  const percent = line.match(/(\d+(?:\.\d+)?)%/), speed = line.match(/at\s+([^\s]+\/s)/), eta = line.match(/ETA\s+([^\s]+)/);
  return {
    percent: percent ? Math.max(0, Math.min(100, Number(percent[1]))) : 0,
    speed: speed ? speed[1] : "", eta: eta ? eta[1] : "",
    status: /100%/.test(line) ? "finished" : "downloading"
  };
}
async function getYtDlpVersion() {
  const result = await runCommand("yt-dlp", ["--version"], 10000);
  return (result.stdout || result.stderr).trim();
}
async function resolveOutputDir(senderId, requestedPath) {
  const approved = approvedOutputDirs.get(senderId) || app.getPath("downloads");
  if (typeof requestedPath === "string" && requestedPath && path.resolve(requestedPath) !== path.resolve(approved)) {
    throw new Error("下載路徑未經本程式資料夾選擇器核准。");
  }
  const real = await fs.realpath(approved);
  if (!(await fs.stat(real)).isDirectory()) throw new Error("下載位置不是資料夾。");
  return real;
}
function createWindow() {
  const win = new BrowserWindow({
    width: 1120, height: 820, minWidth: 850, minHeight: 650, backgroundColor: "#0b1020",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      webSecurity: true, allowRunningInsecureContent: false, devTools: !app.isPackaged
    }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, targetUrl) => {
    if (targetUrl !== win.webContents.getURL()) event.preventDefault();
  });
  win.webContents.on("will-attach-webview", event => event.preventDefault());
  win.on("closed", () => approvedOutputDirs.delete(win.webContents.id));
  win.loadFile(path.join(__dirname, "index.html"));
}

ipcMain.handle("check-tools", async event => {
  assertTrustedSender(event);
  const [version, ffmpeg] = await Promise.all([
    getYtDlpVersion().catch(() => null),
    runCommand("ffmpeg", ["-version"], 10000).then(() => true).catch(() => false)
  ]);
  return { ytDlp: !!version, ytDlpVersion: version, ytDlpSafe: !!version && isYtDlpVersionSafe(version), ffmpeg };
});
ipcMain.handle("choose-folder", async event => {
  assertTrustedSender(event);
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) throw new Error("視窗不存在。");
  const result = await dialog.showOpenDialog(win, { properties: ["openDirectory", "createDirectory"] });
  if (result.canceled || !result.filePaths[0]) return null;
  const selected = await fs.realpath(result.filePaths[0]);
  if (!(await fs.stat(selected)).isDirectory()) throw new Error("選取的路徑不是資料夾。");
  approvedOutputDirs.set(event.sender.id, selected);
  return selected;
});
ipcMain.handle("get-info", async (event, payload) => {
  assertTrustedSender(event);
  try {
    if (!payload || typeof payload !== "object") throw new Error("請求格式錯誤。");
    const url = validateUrl(payload.url);
    const options = normalizeOptions(payload.options || {}, app.getPath("downloads"));
    const args = ["--ignore-config", "--dump-single-json", "--no-warnings"];
    if (!options.playlist) args.push("--no-playlist");
    args.push("--", url);
    const result = await runCommand("yt-dlp", args, INFO_TIMEOUT_MS);
    const info = JSON.parse(result.stdout);
    return {
      ok: true, title: String(info.title || "").slice(0, 500),
      uploader: String(info.uploader || "").slice(0, 300),
      durationText: duration(info.duration),
      formats: Array.isArray(info.formats) ? info.formats.length : 0
    };
  } catch (error) {
    return { ok: false, error: String(error.stderr || error.stdout || error.message || "解析失敗").trim().slice(0, 2000) };
  }
});
ipcMain.handle("cancel-download", event => {
  assertTrustedSender(event);
  const child = activeProcesses.get(event.sender.id);
  if (!child) return false;
  if (process.platform === "win32" && child.pid) {
    execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }, () => {});
  } else if (child.pid) {
    try { process.kill(-child.pid, "SIGTERM"); }
    catch { try { child.kill("SIGTERM"); } catch {} }
  } else child.kill("SIGTERM");
  return true;
});
ipcMain.handle("start-download", async (event, job) => {
  assertTrustedSender(event);
  if (activeProcesses.size > 0) return { ok: false, error: "目前已有下載程序執行中，請等待完成或先取消。" };
  let url, options, outputDir;
  try {
    if (!job || typeof job !== "object" || Array.isArray(job)) throw new Error("下載工作格式錯誤。");
    url = validateUrl(job.url);
    outputDir = await resolveOutputDir(event.sender.id, job.options?.outputPath);
    options = normalizeOptions(job.options || {}, outputDir);
    const version = await getYtDlpVersion();
    if (!isYtDlpVersionSafe(version)) {
      throw new Error("yt-dlp 版本過舊或無法辨識。請升級至 2026.07.04 或更新版本後再下載。");
    }
  } catch (error) { return { ok: false, error: error.message }; }

  const args = buildArgs(options, url, outputDir, path.join(app.getPath("userData"), "download-archive.txt"));
  sendTo(event.sender, "download-log", "\n開始下載：" + url + "\n（命令列參數由安全 GUI 設定產生；不接受自訂參數）\n");
  return new Promise(resolve => {
    const child = spawn("yt-dlp", args, {
      windowsHide: true, detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"]
    });
    activeProcesses.set(event.sender.id, child);
    let settled = false, buffer = "";
    const finish = result => {
      if (settled) return;
      settled = true;
      if (activeProcesses.get(event.sender.id) === child) activeProcesses.delete(event.sender.id);
      resolve(result);
    };
    const onData = chunk => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        sendTo(event.sender, "download-log", line.slice(0, 4000));
        if (/%/.test(line)) sendTo(event.sender, "download-progress", progress(line));
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", error => {
      sendTo(event.sender, "download-log", "程序啟動失敗：" + error.message);
      sendTo(event.sender, "download-complete", { message: "下載啟動失敗" });
      finish({ ok: false, error: error.message });
    });
    child.on("close", code => {
      const ok = code === 0;
      sendTo(event.sender, "download-complete", { message: ok ? "下載完成" : "下載失敗或已取消" });
      finish({ ok, error: ok ? null : "exit code " + code });
    });
  });
});

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": ["default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'; connect-src 'none'"]
      }
    });
  });
  createWindow();
});
app.on("before-quit", () => {
  for (const child of activeProcesses.values()) {
    if (!child.pid) continue;
    if (process.platform === "win32") execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }, () => {});
    else { try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); } }
  }
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
