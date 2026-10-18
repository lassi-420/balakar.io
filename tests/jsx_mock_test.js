// Runs kk-captions.jsx against a recording mock of the AE DOM. Verifies control flow, payload
// parsing, tagging, restyle/read round-trips. It CANNOT verify AE match-names - test those in AE.
const fs = require("fs"), path = require("path"), os = require("os");
const src = fs.readFileSync(path.join(__dirname, "../extension/jsx/kk-captions.jsx"), "utf8").replace("#target aftereffects", "");

function mkProp(name) {
  const store = { name, value: null, expression: "" };
  return new Proxy(function () {}, {
    get(_, k) {
      if (k === "property") return (n) => (store["p_" + n] = store["p_" + n] || mkProp(n));
      if (k === "addProperty") return (n) => (store["p_" + n] = store["p_" + n] || mkProp(n));
      if (k === "setValue") return (v) => { store.value = v; };
      if (k === "value") return store.value || { resetCharStyle() {}, text: store.text || "", set text(v) { store.text = v; }, get text() { return store.text || ""; } };
      if (k === "__store") return store;
      return store[k];
    },
    set(_, k, v) { store[k] = v; return true; }
  });
}
function mkLayer(kind) {
  const props = {};
  const L = { kind, comment: "", name: "", inPoint: 0, outPoint: 0, startTime: 0, removed: false,
    property(n) { return (props[n] = props[n] || mkProp(n)); },
    remove() { this.removed = true; comp.layers_.splice(comp.layers_.indexOf(this), 1); },
    moveAfter() {}, moveToEnd() {}, text: "" };
  const doc = { resetCharStyle() {}, set text(v) { L.text = v; }, get text() { return L.text; } };
  props["ADBE Text Properties"] = { property(n) { return n === "ADBE Text Document" ? { get value() { return doc; }, setValue() {} } : mkProp(n); }, };
  props["ADBE Text Properties"].property = ((orig) => (n) => n === "ADBE Text Animators" ? mkProp("anims") : orig(n))(props["ADBE Text Properties"].property);
  props["ADBE Root Vectors Group"] = mkProp("root");
  return L;
}
const comp = { width: 1080, height: 1920, duration: 60, pixelAspect: 1, layers_: [], selectedLayers: [],
  get numLayers() { return this.layers_.length; }, layer(i) { return this.layers_[i - 1]; },
  layers: { addText(t) { const l = mkLayer("text"); l.text = t; comp.layers_.unshift(l); return l; },
            addShape() { const l = mkLayer("shape"); comp.layers_.unshift(l); return l; },
            addSolid(c, name) { const l = mkLayer("solid"); l.name = name; comp.layers_.push(l); return l; } } };
const rq = { items: { add() { return { outputModule: () => ({ applyTemplate(t) { if (t === "Nope") throw new Error("x"); }, setSettings() {}, file: null }), setSettings() {} }; } }, render() {} };
const g = { app: { project: { activeItem: comp, renderQueue: rq }, beginUndoGroup() {}, endUndoGroup() {}, version: "mock" },
  CompItem: Object.getPrototypeOf(comp).constructor === Object ? function () {} : null };
Object.setPrototypeOf(comp, (g.CompItem.prototype));
g.ParagraphJustification = { CENTER_JUSTIFY: 1 }; g.File = function (p) { this.p = p; this.open = () => true; this.read = () => fs.readFileSync(p, "utf8"); this.close = () => {}; };
g.Folder = () => ({ fsName: os.homedir() });
const run = new Function("app", "CompItem", "ParagraphJustification", "File", "Folder", src + "\nreturn KK;");
const KK = run(g.app, g.CompItem, g.ParagraphJustification, g.File, g.Folder);

function call(payload) {
  const f = path.join(os.tmpdir(), "kk_p.json"); fs.writeFileSync(f, JSON.stringify(payload), "utf8");
  return JSON.parse(KK.runFile(f));
}
const assert = require("assert");
const segs = [
  { id: 1, start: 0, end: 1.2, text: "یہ ایک ٹیسٹ", words: [{ text: "یہ", start: 0, end: .4 }, { text: "ایک", start: .4, end: .8 }, { text: "ٹیسٹ", start: .8, end: 1.2 }] },
  { id: 2, start: 1.3, end: 2.5, text: "second line here", words: [{ text: "second", start: 1.3, end: 1.7 }, { text: "line", start: 1.7, end: 2.1 }, { text: "here", start: 2.1, end: 2.5 }] }];
const style = { mode: "highlight", font: "Arial", fontSize: 80, fill: "#FFFFFF", stroke: "#000000", strokeWidth: 8, uppercase: false,
  tracking: 0, posY: .7, maxWidth: .88, animation: "pop", box: { color: "#FFFFFF", opacity: 100, radius: 20, padX: 20, padY: 10 },
  highlight: { color: "#FFD60A", mode: "active", scale: 112 }, rtl: true };

let r = call({ action: "ping" }); assert(r.ok);
r = call({ action: "build", segments: segs, style, replace: true, language: "ur" });
assert.strictEqual(r.layers, 2); assert.deepStrictEqual(r.warnings, []); assert(/Text Engine/.test(r.note));
assert.strictEqual(comp.layers_.filter(l => l.comment.startsWith("KK_CAPTION")).length, 2);
assert.strictEqual(comp.layers_.filter(l => l.comment.startsWith("KK_BG")).length, 2);
r = call({ action: "read" }); assert.strictEqual(r.segments.length, 2);
assert.strictEqual(r.segments[0].text, "یہ ایک ٹیسٹ"); assert.strictEqual(r.segments[0].words.length, 3);
// restyle all -> same count, no leftovers
r = call({ action: "restyle", applyToAll: true, style: Object.assign({}, style, { box: null, mode: "line" }), language: "ur" });
assert.strictEqual(r.layers, 2); assert.strictEqual(comp.layers_.filter(l => l.comment.startsWith("KK_BG")).length, 0);
// word mode round trip
r = call({ action: "build", segments: segs, style: Object.assign({}, style, { mode: "word", box: null }), replace: true });
assert.strictEqual(r.layers, 6); r = call({ action: "read" }); assert.strictEqual(r.segments.length, 2);
assert.strictEqual(r.segments[1].text, "second line here");
r = call({ action: "remove" }); assert.strictEqual(r.removed, 6);
r = call({ action: "render", mode: "green", template: "Nope" }); assert(r.ok && r.chromaBackground && r.warnings.length === 1);
r = call({ action: "removeChroma" }); assert.strictEqual(r.removed, 1);
r = call({ action: "bogus" }); assert(r.error);
console.log("jsx mock tests passed");
