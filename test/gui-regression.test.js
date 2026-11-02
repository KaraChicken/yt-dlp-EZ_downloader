const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const main = fs.readFileSync(require.resolve("../main.js"), "utf8");
const renderer = fs.readFileSync(require.resolve("../js/renderer.js"), "utf8");
const html = fs.readFileSync(require.resolve("../index.html"), "utf8");
const css = fs.readFileSync(require.resolve("../css/index.css"), "utf8");

test("download lock is reserved before asynchronous preflight", () => {
  const start = main.indexOf('ipcMain.handle("start-download"');
  const reserve = main.indexOf("activeJobId = jobId", start);
  const firstAwait = main.indexOf("await ", start);
  assert.ok(reserve > start && reserve < firstAwait);
  assert.match(main.slice(start), /finally\s*\{[\s\S]*activeJobId = null/);
});

test("preflight cancellation is remembered and checked before spawn", () => {
  const cancel = main.indexOf('ipcMain.handle("cancel-download"');
  const start = main.indexOf('ipcMain.handle("start-download"');
  assert.ok(main.slice(cancel, start).includes("job.cancelRequested = true"));
  const handler = main.slice(start, main.indexOf("\n\napp.whenReady()", start));
  assert.ok(handler.includes("if (isCancelled()) return"));
  assert.ok(handler.includes("control.child = child"));
});

test("queue supports removing one item and clearing all items", () => {
  assert.match(html, /id="clear-queue"/);
  assert.match(renderer, /data-remove/);
  assert.match(renderer, /state\.queue\.splice\(index, 1\)/);
  assert.match(renderer, /state\.queue = \[\]/);
});

test("queue run snapshots options and locks mutable settings", () => {
  assert.match(renderer, /const runOptions = Object\.freeze\(opts\(\)\)/);
  assert.match(renderer, /options: runOptions/);
  assert.match(renderer, /control\.disabled = true/);
});

test("responsive breakpoint is reachable with the Electron minimum width", () => {
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(main, /minWidth:\s*850/);
});

test("environment diagnostics include FFmpeg, FFprobe and JavaScript runtime", () => {
  assert.match(main, /runCommand\("ffmpeg"/);
  assert.match(main, /runCommand\("ffprobe"/);
  assert.match(main, /runCommand\("deno"/);
  assert.match(main, /runCommand\("node"/);
  assert.match(renderer, /defaultOutputPath/);
});
