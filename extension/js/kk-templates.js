/* Caption style presets. Generic names on purpose: no creator names, logos or trademarks.
   Every field is user-overridable (that is the "fully customizable" part). Add your own by
   pushing to KK.templates.list or importing JSON via KK.templates.importJson(). */
(function (g) {
  var KK = (g.KK = g.KK || {});
  var T = (KK.templates = {});
  // mode: line = one layer/segment | word = one layer/word | highlight = line + animated active word
  T.list = [
    { id: "bold-yellow", name: "Bold Highlight", mode: "highlight", font: null, fontSize: 92, fill: "#FFFFFF", stroke: "#000000", strokeWidth: 10, uppercase: true, tracking: 0, posY: 0.72, maxWidth: 0.88, animation: "pop", box: null, highlight: { color: "#FFD60A", mode: "active", scale: 112 } },
    { id: "word-pop", name: "Word Pop", mode: "word", font: null, fontSize: 130, fill: "#FFFFFF", stroke: "#000000", strokeWidth: 12, uppercase: true, tracking: 0, posY: 0.55, maxWidth: 0.9, animation: "pop", box: null },
    { id: "clean-minimal", name: "Clean Minimal", mode: "line", font: null, fontSize: 64, fill: "#FFFFFF", stroke: null, strokeWidth: 0, uppercase: false, tracking: 0, posY: 0.85, maxWidth: 0.86, animation: "fade", box: null },
    { id: "karaoke-green", name: "Karaoke Fill", mode: "highlight", font: null, fontSize: 80, fill: "#FFFFFF", stroke: "#0B1A0B", strokeWidth: 8, uppercase: false, tracking: 0, posY: 0.78, maxWidth: 0.88, animation: "fade", box: null, highlight: { color: "#3DDC84", mode: "cumulative", scale: 100 } },
    { id: "bubble", name: "Bubble Box", mode: "line", font: null, fontSize: 66, fill: "#111111", stroke: null, strokeWidth: 0, uppercase: false, tracking: 0, posY: 0.8, maxWidth: 0.8, animation: "pop", box: { color: "#FFFFFF", opacity: 100, radius: 36, padX: 36, padY: 20 } },
    { id: "dark-box", name: "Dark Box", mode: "line", font: null, fontSize: 60, fill: "#FFFFFF", stroke: null, strokeWidth: 0, uppercase: false, tracking: 0, posY: 0.86, maxWidth: 0.84, animation: "slideUp", box: { color: "#000000", opacity: 70, radius: 12, padX: 28, padY: 14 } },
    { id: "heavy-outline", name: "Heavy Outline", mode: "line", font: null, fontSize: 100, fill: "#FFE600", stroke: "#000000", strokeWidth: 16, uppercase: true, tracking: 0, posY: 0.7, maxWidth: 0.9, animation: "pop", box: null },
    { id: "neon-cyan", name: "Neon Glow", mode: "highlight", font: null, fontSize: 84, fill: "#E6FBFF", stroke: "#00B7FF", strokeWidth: 6, uppercase: false, tracking: 20, posY: 0.74, maxWidth: 0.88, animation: "fade", box: null, highlight: { color: "#FF2EC4", mode: "active", scale: 108 } },
    { id: "typewriter", name: "Typewriter", mode: "line", font: null, fontSize: 62, fill: "#F5F5F5", stroke: "#000000", strokeWidth: 4, uppercase: false, tracking: 0, posY: 0.84, maxWidth: 0.86, animation: "typewriter", box: null },
    { id: "reels-center", name: "Reels Center", mode: "highlight", font: null, fontSize: 110, fill: "#FFFFFF", stroke: "#000000", strokeWidth: 12, uppercase: true, tracking: 0, posY: 0.5, maxWidth: 0.9, animation: "pop", box: null, highlight: { color: "#FF3B30", mode: "active", scale: 115 } },
    { id: "soft-shadow", name: "Soft Lower Third", mode: "line", font: null, fontSize: 58, fill: "#FFFFFF", stroke: "#00000099", strokeWidth: 3, uppercase: false, tracking: 0, posY: 0.9, maxWidth: 0.8, animation: "slideUp", box: null },
    { id: "two-tone", name: "Two-Tone Active", mode: "highlight", font: null, fontSize: 88, fill: "#9AA4B2", stroke: "#000000", strokeWidth: 8, uppercase: false, tracking: 0, posY: 0.75, maxWidth: 0.88, animation: "none", box: null, highlight: { color: "#FFFFFF", mode: "active", scale: 100 } }
  ];

  T.get = function (id) {
    for (var i = 0; i < T.list.length; i++) if (T.list[i].id === id) return T.list[i];
    return T.list[0];
  };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* Resolve a template + user overrides + language into the final style sent to ExtendScript. */
  T.resolve = function (id, overrides, langCode) {
    var t = clone(T.get(id)), o = overrides || {};
    Object.keys(o).forEach(function (k) {
      if (o[k] === undefined || o[k] === null || o[k] === "") return;
      if (k === "highlight" || k === "box") t[k] = Object.assign(t[k] || {}, o[k]); else t[k] = o[k];
    });
    var L = KK.lang && KK.lang(langCode);
    if (!t.font) t.font = (L && L.font) || "Arial-BoldMT";
    // Latin-only effects make no sense for Indic/Arabic scripts
    if (L && L.code !== "en" && L.code !== "ms") t.uppercase = false;
    t.rtl = !!(L && L.rtl);
    if (t.rtl) t.tracking = 0;                    // tracking breaks Arabic-script joining
    return t;
  };

  T.exportJson = function () { return JSON.stringify(T.list, null, 2); };
  T.importJson = function (text) {
    var arr = JSON.parse(text); if (!Array.isArray(arr)) arr = [arr];
    arr.forEach(function (t) {
      if (!t.id || !t.name || !t.mode) throw new Error("template needs id, name, mode");
      for (var i = 0; i < T.list.length; i++) if (T.list[i].id === t.id) { T.list[i] = t; return; }
      T.list.push(t);
    });
  };
})(typeof window !== "undefined" ? window : globalThis);
