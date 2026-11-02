const $ = id => document.getElementById(id);
const state = { queue: [], running: false, current: -1, unsubscribers: [] };

function log(message) {
  const line = typeof message === "string" ? message : JSON.stringify(message);
  $("log").textContent += line.endsWith("\n") ? line : line + "\n";
  $("log").scrollTop = $("log").scrollHeight;
}
function urls() {
  return $("video-url").value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
}
function esc(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function renderQueue() {
  const el = $("queue");
  if (!state.queue.length) {
    el.className = "queue-empty";
    el.textContent = "尚未加入下載項目";
    return;
  }
  el.className = "";
  el.innerHTML = state.queue.map((item, index) =>
    '<div class="queue-item"><span class="queue-number">' +
    String(index + 1).padStart(2, "0") +
    '</span><span class="queue-url" title="' + esc(item.url) + '">' +
    esc(item.url) + '</span><span class="queue-status">' +
    (index === state.current ? "下載中" : item.status) +
    "</span></div>"
  ).join("");
}
function opts() {
  return {
    mode: $("mode").value,
    resolution: $("resolution").value,
    container: $("container").value,
    audioFormat: $("audio-format").value,
    audioQuality: $("audio-quality").value,
    playlist: $("playlist").checked,
    subtitles: $("subtitles").checked,
    autoSubs: $("auto-subs").checked,
    thumbnail: $("thumbnail").checked,
    metadata: $("metadata").checked,
    archive: $("archive").checked,
    proxy: $("proxy").value.trim(),
    rateLimit: $("rate-limit").value.trim(),
    fragments: $("fragments").value,
    retries: $("retries").value,
    cookies: $("cookies").value,
    outputPath: $("output-path").value || ""
  };
}
function setMode() {
  $("video-options").classList.toggle("hidden", $("mode").value !== "video");
  $("audio-options").classList.toggle("hidden", $("mode").value !== "audio");
}
$("mode").addEventListener("change", setMode);
$("advanced-toggle").addEventListener("click", () => $("advanced-panel").classList.toggle("hidden"));
$("clear-urls").addEventListener("click", () => {
  $("video-url").value = "";
  $("media-info").classList.add("hidden");
});
$("clear-log").addEventListener("click", () => { $("log").textContent = ""; });
$("folder-btn").addEventListener("click", async () => {
  try {
    const selected = await window.ytDlp.chooseFolder();
    if (selected) $("output-path").value = selected;
  } catch (error) { log(error.message); }
});
$("inspect-btn").addEventListener("click", async () => {
  const list = urls();
  if (!list.length) { log("請先輸入 URL"); return; }
  $("inspect-btn").disabled = true;
  try {
    const result = await window.ytDlp.getInfo(list[0], { playlist: $("playlist").checked });
    if (!result.ok) { log(result.error); return; }
    $("media-info").classList.remove("hidden");
    $("media-info").innerHTML =
      "<strong>" + esc(result.title || "未知標題") + "</strong><span>" +
      esc(result.uploader || "未知頻道") + " · " +
      esc(result.durationText || "未知時長") + " · " +
      Number(result.formats) + " 個格式</span>";
    log("已解析：" + (result.title || list[0]));
  } catch (error) { log(error.message); }
  finally { $("inspect-btn").disabled = false; }
});
$("add-queue").addEventListener("click", () => {
  const list = urls();
  if (!list.length) { log("請先輸入 URL"); return; }
  let added = 0;
  for (const url of list) {
    if (!state.queue.some(item => item.url === url)) {
      state.queue.push({ url, status: "等待中" });
      added++;
    }
  }
  $("video-url").value = "";
  renderQueue();
  log("加入 " + added + " 個網址");
});
async function start() {
  if (state.running) return;
  if (!state.queue.length) {
    $("add-queue").click();
    if (!state.queue.length) return;
  }
  state.running = true;
  $("download-btn").classList.add("hidden");
  $("cancel-btn").classList.remove("hidden");
  $("progress-wrap").classList.remove("hidden");
  for (let index = 0; index < state.queue.length; index++) {
    if (!state.running) break;
    if (state.queue[index].status === "完成") continue;
    state.current = index;
    state.queue[index].status = "下載中";
    renderQueue();
    $("progress-bar").style.width = "0%";
    $("progress-percent").textContent = "0%";
    $("progress-text").textContent = "下載中";
    try {
      const result = await window.ytDlp.startDownload({
        url: state.queue[index].url,
        options: opts()
      });
      state.queue[index].status = result.ok ? "完成" : "失敗";
      if (!result.ok) log(result.error || "下載失敗");
    } catch (error) {
      state.queue[index].status = "失敗";
      log(error.message);
    }
    renderQueue();
  }
  state.current = -1;
  state.running = false;
  $("download-btn").classList.remove("hidden");
  $("cancel-btn").classList.add("hidden");
  renderQueue();
}
$("download-btn").addEventListener("click", start);
$("cancel-btn").addEventListener("click", async () => {
  state.running = false;
  await window.ytDlp.cancelDownload();
  log("已要求取消目前下載");
});
state.unsubscribers.push(
  window.ytDlp.onProgress(data => {
    $("progress-bar").style.width = Math.max(0, Math.min(100, Number(data.percent || 0))) + "%";
    $("progress-percent").textContent = Number(data.percent || 0).toFixed(1) + "%";
    $("progress-text").textContent = data.status === "finished" ? "處理中" : "下載中";
    $("speed").textContent = data.speed || "—";
    $("eta").textContent = data.eta ? "剩餘時間 " + data.eta : "剩餘時間 —";
  }),
  window.ytDlp.onLog(log),
  window.ytDlp.onComplete(data => log(data.message || data))
);
window.addEventListener("beforeunload", () => state.unsubscribers.forEach(unsubscribe => unsubscribe()));
(async () => {
  try {
    const result = await window.ytDlp.checkTools();
    if (!result.ytDlp) {
      $("tool-status").textContent = "找不到 yt-dlp";
      log("請先安裝 yt-dlp，並確認可從 PATH 執行。");
    } else if (!result.ytDlpSafe) {
      $("tool-status").textContent = "yt-dlp 版本過舊";
      log("安全要求：請將 yt-dlp 更新至 2026.07.04 或更新版本。偵測版本：" + result.ytDlpVersion);
    } else {
      $("tool-status").textContent = "yt-dlp " + result.ytDlpVersion;
    }
    if (!result.ffmpeg) log("提示：找不到 FFmpeg；合併影音或音訊轉檔可能失敗。");
  } catch (error) { log(error.message); }
})();
renderQueue();
setMode();
