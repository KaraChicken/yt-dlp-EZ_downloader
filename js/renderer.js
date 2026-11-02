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
    '</span><button class="button ghost small queue-move" data-move="up" data-index="' + index + '" ' +
    (state.running || index === 0 ? "disabled" : "") + '>上移</button>' +
    '<button class="button ghost small queue-move" data-move="down" data-index="' + index + '" ' +
    (state.running || index === state.queue.length - 1 ? "disabled" : "") + '>下移</button>' +
    '<button class="button ghost small queue-remove" data-remove="' + index + '" ' +
    (state.running ? "disabled" : "") + '>移除</button></div>'
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
$("clear-queue").addEventListener("click", () => {
  if (state.running) return;
  state.queue = [];
  state.current = -1;
  renderQueue();
  log("已清空下載佇列");
});
$("queue").addEventListener("click", event => {
  if (state.running) return;
  const move = event.target.closest("[data-move]");
  if (move) {
    const from = Number(move.dataset.index);
    const to = from + (move.dataset.move === "up" ? -1 : 1);
    if (Number.isInteger(from) && to >= 0 && to < state.queue.length) {
      const [item] = state.queue.splice(from, 1);
      state.queue.splice(to, 0, item);
      renderQueue();
    }
    return;
  }
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  const index = Number(button.dataset.remove);
  if (Number.isInteger(index) && index >= 0 && index < state.queue.length) {
    state.queue.splice(index, 1);
    renderQueue();
  }
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
  const runOptions = Object.freeze(opts());
  document.querySelectorAll("main input, main select, main textarea, #add-queue, #clear-queue, #inspect-btn, #folder-btn, #advanced-toggle").forEach(control => {
    if (control.id !== "video-url") control.disabled = true;
  });
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
        options: runOptions
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
  document.querySelectorAll("main input, main select, main textarea, #add-queue, #clear-queue, #inspect-btn, #folder-btn, #advanced-toggle").forEach(control => { control.disabled = false; });
  $("download-btn").classList.remove("hidden");
  $("cancel-btn").classList.add("hidden");
  renderQueue();
}
$("download-btn").addEventListener("click", start);
$("cancel-btn").addEventListener("click", async () => {
  state.running = false;
  const accepted = await window.ytDlp.cancelDownload();
  log(accepted ? "已送出取消要求（包含前置檢查階段）" : "目前沒有可取消的下載工作");
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

let mediaLoaded = false;
let conversionRunning = false;
const mediaElements = [$("media-player"), $("audio-player")];
$("open-media").addEventListener("click", async () => {
  try {
    const selected = await window.ytDlp.chooseMediaFile();
    if (!selected) return;
    mediaElements.forEach(player => { player.pause(); player.removeAttribute("src"); player.load(); player.classList.add("hidden"); });
    const isAudio = /\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i.test(selected.name);
    const player = isAudio ? $("audio-player") : $("media-player");
    player.src = selected.url;
    player.classList.remove("hidden");
    $("media-file-name").textContent = selected.name;
    mediaLoaded = true;
    $("conversion-status").textContent = "已選擇來源檔案：" + selected.name;
  } catch (error) { log(error.message); }
});
$("convert-btn").addEventListener("click", async () => {
  if (!mediaLoaded || conversionRunning) {
    $("conversion-status").textContent = mediaLoaded ? "轉檔工作正在執行。" : "請先開啟本機影音檔案。";
    return;
  }
  conversionRunning = true;
  $("convert-btn").disabled = true;
  $("conversion-format").disabled = true;
  $("cancel-conversion-btn").classList.remove("hidden");
  $("conversion-status").textContent = "正在準備轉檔與選擇輸出位置…";
  $("conversion-log").textContent = "";
  try {
    const result = await window.ytDlp.convertMedia($("conversion-format").value);
    if (result.cancelled) $("conversion-status").textContent = "已取消轉檔。";
    else if (result.ok) $("conversion-status").textContent = "轉檔完成：" + result.output;
    else $("conversion-status").textContent = "轉檔失敗：" + (result.error || "請確認 FFmpeg 與輸出格式支援。");
  } catch (error) { $("conversion-status").textContent = "轉檔失敗：" + error.message; }
  finally {
    conversionRunning = false;
    $("convert-btn").disabled = false;
    $("conversion-format").disabled = false;
    $("cancel-conversion-btn").classList.add("hidden");
  }
});
$("cancel-conversion-btn").addEventListener("click", async () => {
  const accepted = await window.ytDlp.cancelConversion();
  $("conversion-status").textContent = accepted ? "已送出取消要求…" : "目前沒有可取消的轉檔。";
});
state.unsubscribers.push(
  window.ytDlp.onConversionProgress(data => {
    if (data.done) $("conversion-status").textContent = "轉檔即將完成…";
    else if (Number.isFinite(data.seconds)) $("conversion-status").textContent = "轉檔中，已處理 " + Math.floor(data.seconds) + " 秒媒體時間";
  }),
  window.ytDlp.onConversionLog(data => {
    $("conversion-log").textContent = ($("conversion-log").textContent + data).slice(-12000);
    $("conversion-log").scrollTop = $("conversion-log").scrollHeight;
  })
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
    if (!result.ffprobe) log("提示：找不到 FFprobe；部分媒體資訊與後處理功能可能受影響。");
    if (!result.jsRuntime) log("提示：未偵測到 Deno 或 Node.js；YouTube 部分格式可能需要 JavaScript runtime。");
    $("output-path").value = result.defaultOutputPath || "";
  } catch (error) { log(error.message); }
})();
renderQueue();
setMode();
