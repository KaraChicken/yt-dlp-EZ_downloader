const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const main = fs.readFileSync(require.resolve("../main.js"), "utf8");
const preload = fs.readFileSync(require.resolve("../preload.js"), "utf8");
const renderer = fs.readFileSync(require.resolve("../js/renderer.js"), "utf8");
const html = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("local media selection is restricted to native file picker and real files", () => {
  assert.match(main, /ipcMain\.handle\("choose-media-file"/);
  assert.match(main, /dialog\.showOpenDialog/);
  assert.match(main, /fs\.realpath/);
  assert.match(main, /stat\.isFile\(\)/);
  assert.match(main, /pathToFileURL\(selected\)/);
});

test("conversion format is allowlisted and never invokes a shell", () => {
  assert.match(main, /Object\.hasOwn\(CONVERSION_FORMATS, format\)/);
  assert.match(main, /spawn\("ffmpeg", args/);
  assert.doesNotMatch(main, /exec\(["']ffmpeg/);
  assert.match(main, /path\.extname\(output\)\.toLowerCase\(\) !== "\." \+ format/);
});

test("conversion reserves the job lock before awaiting the save dialog", () => {
  const start = main.indexOf('ipcMain.handle("convert-media"');
  const reserve = main.indexOf("conversionJobs.set(event.sender.id, control)", start);
  const firstAwait = main.indexOf("await ", start);
  assert.ok(reserve > start && reserve < firstAwait);
  assert.match(main.slice(start), /finally\s*\{[\s\S]*conversionJobs\.delete/);
});

test("conversion supports cancellation and cleans up on application exit", () => {
  assert.match(main, /ipcMain\.handle\("cancel-conversion"/);
  assert.match(main, /job\.cancelRequested = true/);
  assert.match(main, /for \(const job of conversionJobs\.values\(\)\)/);
});

test("preload exposes only narrow media and conversion operations", () => {
  for (const api of ["chooseMediaFile", "convertMedia", "cancelConversion", "onConversionProgress", "onConversionLog"]) {
    assert.ok(preload.includes(api), "missing " + api);
  }
});

test("GUI contains native playback controls and supported conversion formats", () => {
  assert.match(html, /id="media-player"[^>]*controls/);
  assert.match(html, /id="audio-player"[^>]*controls/);
  for (const format of ["mp4","mkv","webm","mp3","m4a","wav","flac","opus"]) {
    assert.ok(html.includes('value="' + format + '"'), "missing " + format);
  }
  assert.match(renderer, /chooseMediaFile/);
  assert.match(renderer, /convertMedia/);
});
