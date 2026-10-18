/* Client-side exporters (SRT/VTT/TXT/MD). DOCX goes through the backend (needs a file path). */
(function (g) {
  var KK = (g.KK = g.KK || {});
  var E = (KK.exporters = {});
  var ts = function (t, sep) { return KK.segments.ts(t, sep); };

  E.srt = function (segs) {
    return segs.map(function (s, i) { return (i + 1) + "\n" + ts(s.start, ",") + " --> " + ts(s.end, ",") + "\n" + s.text + "\n"; }).join("\n");
  };
  E.vtt = function (segs) {
    return "WEBVTT\n\n" + segs.map(function (s) { return ts(s.start, ".") + " --> " + ts(s.end, ".") + "\n" + s.text + "\n"; }).join("\n");
  };
  E.txt = function (segs, withTime) {
    return withTime ? segs.map(function (s) { return "[" + ts(s.start, ".").slice(0, -4) + "] " + s.text; }).join("\n") + "\n"
                    : segs.map(function (s) { return s.text; }).join(" ").trim() + "\n";
  };
  E.md = function (segs, title) {
    return "# " + (title || "Transcript") + "\n\n" + segs.map(function (s) { return "**[" + ts(s.start, ".").slice(0, -4) + "]** " + s.text + "\n"; }).join("\n");
  };
  E.build = function (fmt, segs, o) {
    o = o || {};
    if (fmt === "srt") return E.srt(segs);
    if (fmt === "vtt") return E.vtt(segs);
    if (fmt === "txt") return E.txt(segs, o.timestamps);
    if (fmt === "md") return E.md(segs, o.title);
    throw new Error("Use backend for " + fmt);
  };

  /* Save via CEP's fs (UTF-8, no Node required). Returns a Promise<path>. */
  E.save = function (path, text) {
    return new Promise(function (resolve, reject) {
      var cep = g.cep;
      if (!cep || !cep.fs) return reject(new Error("cep.fs unavailable"));
      var r = cep.fs.writeFile(path, text, cep.encoding.UTF8);
      if (r.err === 0) resolve(path); else reject(new Error("writeFile error " + r.err));
    });
  };
  E.saveDialog = function (title, defaultName, exts) {
    var r = g.cep.fs.showSaveDialogEx(title, "", exts, defaultName, "");
    return r && r.err === 0 && r.data ? r.data : null;
  };
  E.openDialog = function (title, exts, multi) {
    var r = g.cep.fs.showOpenDialogEx(!!multi, false, title, "", exts || []);
    return r && r.err === 0 ? r.data : [];
  };
  E.read = function (path) {
    var r = g.cep.fs.readFile(path, g.cep.encoding.UTF8);
    if (r.err !== 0) throw new Error("readFile error " + r.err);
    return r.data;
  };
})(typeof window !== "undefined" ? window : globalThis);
