const path = require("node:path");
const MIN_YTDLP_VERSION = [2026, 7, 4];
const MODES = new Set(["video", "audio"]);
const RESOLUTIONS = new Set(["best", "2160", "1440", "1080", "720", "480", "360"]);
const CONTAINERS = new Set(["mp4", "mkv", "webm"]);
const AUDIO_FORMATS = new Set(["mp3", "m4a", "opus", "flac", "wav"]);
const AUDIO_QUALITIES = new Set(["0", "2", "5", "7"]);
const COOKIES = new Set(["", "chrome", "edge", "firefox", "brave"]);
function validateUrl(value) {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) throw new Error("網址格式不正確。");
  let url;
  try { url = new URL(value); } catch { throw new Error("請輸入有效的網址。"); }
  if (!["http:","https:"].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error("僅允許不含帳密的 HTTP / HTTPS 網址。");
  return url.href;
}
function normalizeOptions(input, approvedOutputPath) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("下載設定格式錯誤。");
  const allowed = new Set(["mode","resolution","container","audioFormat","audioQuality","playlist","subtitles","autoSubs","thumbnail","metadata","archive","proxy","rateLimit","fragments","retries","cookies","outputPath"]);
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new Error("包含不支援的設定欄位：" + key);
  const o = {
    mode: input.mode ?? "video", resolution: input.resolution ?? "best", container: input.container ?? "mp4",
    audioFormat: input.audioFormat ?? "mp3", audioQuality: String(input.audioQuality ?? "0"),
    playlist: input.playlist === true, subtitles: input.subtitles === true, autoSubs: input.autoSubs === true,
    thumbnail: input.thumbnail === true, metadata: input.metadata !== false, archive: input.archive === true,
    proxy: typeof input.proxy === "string" ? input.proxy.trim() : "",
    rateLimit: typeof input.rateLimit === "string" ? input.rateLimit.trim() : "",
    fragments: Number(input.fragments ?? 4), retries: Number(input.retries ?? 10),
    cookies: input.cookies ?? "", outputPath: approvedOutputPath
  };
  if (!MODES.has(o.mode) || !RESOLUTIONS.has(o.resolution) || !CONTAINERS.has(o.container) || !AUDIO_FORMATS.has(o.audioFormat) || !AUDIO_QUALITIES.has(o.audioQuality)) throw new Error("格式或品質選項無效。");
  if (!Number.isInteger(o.fragments) || o.fragments < 1 || o.fragments > 16) throw new Error("並行片段數必須介於 1 到 16。");
  if (!Number.isInteger(o.retries) || o.retries < 0 || o.retries > 10) throw new Error("重試次數必須介於 0 到 10。");
  if (!COOKIES.has(o.cookies)) throw new Error("Cookies 瀏覽器選項無效。");
  for (const key of ["playlist","subtitles","autoSubs","thumbnail","metadata","archive"]) if (input[key] !== undefined && typeof input[key] !== "boolean") throw new Error("選項格式無效：" + key);
  if (o.proxy) {
    let proxy;
    try { proxy = new URL(o.proxy); } catch { throw new Error("Proxy 必須是有效的 URL。"); }
    if (!["http:","https:","socks5:"].includes(proxy.protocol) || !proxy.hostname || proxy.username || proxy.password || /[\r\n]/.test(o.proxy)) throw new Error("Proxy 僅支援不含帳密的 HTTP、HTTPS 或 SOCKS5 URL。");
  }
  if (o.rateLimit && !/^\d+(?:\.\d+)?(?:K|M|G)?$/i.test(o.rateLimit)) throw new Error("速度上限格式錯誤，例如 500K 或 5M。");
  return o;
}
function parseYtDlpVersion(output) {
  const match = String(output).trim().match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  return match ? match.slice(1).map(Number) : null;
}
function isYtDlpVersionSafe(output) {
  const version = parseYtDlpVersion(output);
  if (!version) return false;
  for (let i = 0; i < MIN_YTDLP_VERSION.length; i++) {
    if (version[i] > MIN_YTDLP_VERSION[i]) return true;
    if (version[i] < MIN_YTDLP_VERSION[i]) return false;
  }
  return true;
}
function buildArgs(o, url, outputPath, archivePath) {
  const args = ["--ignore-config","--no-warnings","--newline","--no-color"];
  if (!o.playlist) args.push("--no-playlist");
  if (o.mode === "audio") args.push("-x","--audio-format",o.audioFormat,"--audio-quality",o.audioQuality);
  else {
    const format = o.resolution === "best" ? "bv*+ba/b" : "bv*[height<=" + o.resolution + "]+ba/b[height<=" + o.resolution + "]/b";
    args.push("-f",format,"--merge-output-format",o.container);
  }
  args.push("-o",path.join(outputPath,"%(title)s.%(ext)s"));
  if (o.subtitles) args.push("--write-subs","--sub-langs","all");
  if (o.autoSubs) args.push("--write-auto-subs");
  if (o.thumbnail) args.push("--embed-thumbnail");
  if (o.metadata) args.push("--embed-metadata");
  if (o.archive) args.push("--download-archive",archivePath);
  if (o.proxy) args.push("--proxy",o.proxy);
  if (o.rateLimit) args.push("--limit-rate",o.rateLimit);
  args.push("--concurrent-fragments",String(o.fragments),"--retries",String(o.retries));
  if (o.cookies) args.push("--cookies-from-browser",o.cookies);
  args.push("--",url);
  return args;
}
module.exports = { MIN_YTDLP_VERSION, validateUrl, normalizeOptions, parseYtDlpVersion, isYtDlpVersionSafe, buildArgs };
