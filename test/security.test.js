const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { validateUrl, normalizeOptions, parseYtDlpVersion, isYtDlpVersionSafe, buildArgs } = require("../security");

test("accepts HTTP and HTTPS URLs only", () => {
  assert.equal(validateUrl("https://example.com/video"), "https://example.com/video");
  for (const url of ["file:///etc/passwd","javascript:alert(1)","ftp://example.com/file","https://user:pass@example.com/","https://example.com/\n--exec"]) {
    assert.throws(() => validateUrl(url));
  }
});
test("rejects removed custom command arguments and format selector", () => {
  assert.throws(() => normalizeOptions({ extraArgs: "--exec echo pwned" }, "/tmp"));
  assert.throws(() => normalizeOptions({ formatCode: "best" }, "/tmp"));
  assert.throws(() => normalizeOptions({ mode: "custom" }, "/tmp"));
});
test("validates GUI enums and numeric limits", () => {
  assert.equal(normalizeOptions({ mode: "video", resolution: "1080" }, "/tmp").resolution, "1080");
  assert.throws(() => normalizeOptions({ resolution: "9999" }, "/tmp"));
  assert.throws(() => normalizeOptions({ fragments: 99 }, "/tmp"));
  assert.throws(() => normalizeOptions({ retries: -1 }, "/tmp"));
  assert.throws(() => normalizeOptions({ rateLimit: "--exec" }, "/tmp"));
  assert.throws(() => normalizeOptions({ proxy: "file:///tmp" }, "/tmp"));
});
test("requires yt-dlp 2026.07.04 or newer", () => {
  assert.deepEqual(parseYtDlpVersion("2026.7.4"), [2026, 7, 4]);
  assert.equal(isYtDlpVersionSafe("2026.7.3"), false);
  assert.equal(isYtDlpVersionSafe("2026.7.4"), true);
  assert.equal(isYtDlpVersionSafe("2026.10.1"), true);
  assert.equal(isYtDlpVersionSafe("unknown"), false);
});
test("builds only GUI-derived arguments and terminates options before URL", () => {
  const options = normalizeOptions({ mode: "video", resolution: "720", archive: true }, "/safe/output");
  const args = buildArgs(options, "https://example.com/video", "/safe/output", path.join("/appdata", "archive.txt"));
  assert.ok(args.includes("--ignore-config"));
  assert.ok(args.includes("--no-playlist"));
  assert.equal(args.at(-2), "--");
  assert.equal(args.at(-1), "https://example.com/video");
  assert.equal(args.some(arg => arg === "--exec" || arg === "--netrc-cmd"), false);
});
