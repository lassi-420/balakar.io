const assert = require("assert"), fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
["kk-languages", "kk-segments", "kk-export", "kk-templates"].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, "../extension/js", f + ".js"), "utf8"), ctx));
const KK = ctx.KK;

// normalize: HF pipeline chunks, whisper segments, plain
let segs = KK.segments.normalize({ chunks: [{ text: " yeh", timestamp: [0, .3] }, { text: " ek", timestamp: [.35, .6] }, { text: " test.", timestamp: [.7, 1.1] }, { text: " phir", timestamp: [1.2, 1.5] }] });
assert(segs.length >= 2 && segs[0].words.length >= 2);
segs = KK.segments.normalize({ segments: [{ start: 0, end: 2, text: " hello world ", words: [{ word: "hello", start: 0, end: 1 }, { word: "world", start: 1, end: 2 }] }] });
assert.strictEqual(segs[0].text, "hello world"); assert.strictEqual(segs[0].words[1].text, "world");

// edit ops
let s = KK.segments.setText(segs, 0, "hi there"); assert.strictEqual(s[0].words.length, 2);
s = KK.segments.split(KK.segments.normalize([{ start: 0, end: 4, text: "a b c d", words: [] }].map(x => (x.words = KK.segments.spread(x.text, 0, 4), x))), 0, 2);
assert.strictEqual(s.length, 2); assert.strictEqual(s[1].text, "c d");
s = KK.segments.merge(s, 0); assert.strictEqual(s.length, 1);
assert.strictEqual(KK.segments.shift(s, 1.5)[0].start, 1.5);

// SRT / VTT round-trip incl. Urdu
const ur = [{ id: 1, start: 0, end: 1.5, text: "یہ ایک ٹیسٹ ہے", words: [] }, { id: 2, start: 3661.25, end: 3662, text: "second", words: [] }];
for (const fmt of ["srt", "vtt"]) {
  const out = KK.exporters.build(fmt, ur), back = KK.segments.parseSubtitles(out);
  assert.strictEqual(back.length, 2); assert.strictEqual(back[0].text, ur[0].text); assert(Math.abs(back[1].start - 3661.25) < 0.002);
}
assert(KK.exporters.srt(ur).includes("01:01:01,250 --> 01:01:02,000"));
assert(KK.exporters.md(ur, "T").startsWith("# T"));

// templates
const t = KK.templates.resolve("bold-yellow", { fontSize: 70, highlight: { color: "#00FF00" } }, "ur");
assert.strictEqual(t.fontSize, 70); assert.strictEqual(t.highlight.color, "#00FF00"); assert.strictEqual(t.highlight.mode, "active");
assert.strictEqual(t.uppercase, false); assert.strictEqual(t.rtl, true); assert.strictEqual(t.font, "NotoNastaliqUrdu");
assert.strictEqual(KK.templates.resolve("bold-yellow", {}, "en").uppercase, true);
KK.templates.importJson(JSON.stringify({ id: "mine", name: "Mine", mode: "line" })); assert(KK.templates.get("mine").id === "mine");
assert.throws(() => KK.templates.importJson('{"id":"x"}'));
assert.strictEqual(KK.languages.length, 20);
console.log("panel tests passed");
