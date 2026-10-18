/* Segment model: normalise any Whisper output, regroup, edit, parse/serialise subtitles. ES2015-safe. */
(function (g) {
  var KK = (g.KK = g.KK || {});
  var S = (KK.segments = {});

  function clean(t) { return String(t == null ? "" : t).replace(/\s+/g, " ").trim(); }
  S.clean = clean;

  /* Accepts: our backend result, HF pipeline output ({chunks:[{text,timestamp:[s,e]}]}),
     openai-whisper / whisper.cpp / faster-whisper JSON ({segments:[{start,end,text,words?}]}),
     or a plain segment array. This is the adapter that lets an existing local-Whisper
     pipeline feed the rest of the kit. */
  S.normalize = function (raw) {
    var segs = [];
    if (!raw) return segs;
    if (Array.isArray(raw)) segs = raw.map(function (s) { return S._seg(s); });
    else if (raw.segments) segs = raw.segments.map(function (s) { return S._seg(s); });
    else if (raw.chunks) {
      var words = raw.chunks.filter(function (c) { return c.timestamp && c.timestamp[0] != null; })
        .map(function (c) { return { text: c.text, start: c.timestamp[0], end: c.timestamp[1] == null ? c.timestamp[0] + 0.3 : c.timestamp[1] }; });
      segs = S.group(words, {});
    }
    return S.reindex(segs.filter(function (s) { return clean(s.text); }));
  };
  S._seg = function (s) {
    var w = (s.words || []).map(function (x) {
      return { text: clean(x.text != null ? x.text : x.word), start: +x.start, end: +x.end };
    });
    return { id: s.id, start: +s.start, end: +s.end, text: clean(s.text), words: w };
  };
  S.reindex = function (segs) { segs.forEach(function (s, i) { s.id = i + 1; }); return segs; };

  S.group = function (words, o) {
    o = Object.assign({ maxChars: 32, maxWords: 6, maxGap: 0.6, maxDuration: 4.0, breakOnPunct: true }, o || {});
    var segs = [], cur = [];
    function flush() {
      if (!cur.length) return;
      segs.push({ id: segs.length + 1, start: cur[0].start, end: cur[cur.length - 1].end,
        text: cur.map(function (w) { return w.text; }).join(" "), words: cur.slice() });
      cur = [];
    }
    words.forEach(function (w) {
      w = { text: clean(w.text), start: +w.start, end: +w.end };
      if (!w.text) return;
      if (cur.length) {
        var len = cur.map(function (x) { return x.text; }).join(" ").length + 1 + w.text.length;
        if (len > o.maxChars || cur.length >= o.maxWords || w.start - cur[cur.length - 1].end > o.maxGap ||
            w.end - cur[0].start > o.maxDuration) flush();
      }
      cur.push(w);
      if (o.breakOnPunct && /[.!?؟۔।,;:،]$/.test(w.text) && cur.length >= 2) flush();
    });
    flush();
    for (var i = 0; i < segs.length; i++) {
      if (segs[i].end <= segs[i].start) segs[i].end = segs[i].start + 0.2;
      if (i + 1 < segs.length && segs[i].end > segs[i + 1].start) segs[i].end = segs[i + 1].start;
    }
    return segs;
  };
  S.allWords = function (segs) { return [].concat.apply([], segs.map(function (s) { return s.words || []; })); };
  S.regroup = function (segs, o) {
    var w = S.allWords(segs);
    return w.length ? S.group(w, o) : segs;
  };

  S.spread = function (text, start, end) {
    var toks = clean(text).split(" ").filter(Boolean), total = 0, t0 = start, out = [];
    toks.forEach(function (t) { total += Math.max(t.length, 1); });
    toks.forEach(function (t) {
      var d = (end - start) * Math.max(t.length, 1) / total;
      out.push({ text: t, start: +t0.toFixed(3), end: +(t0 + d).toFixed(3) }); t0 += d;
    });
    return out;
  };

  /* editing ops (all return a new array) */
  S.setText = function (segs, i, text) {
    var s = segs.slice(); var o = Object.assign({}, s[i]);
    if (clean(text) !== o.text) { o.text = clean(text); o.words = S.spread(o.text, o.start, o.end); }
    s[i] = o; return s;
  };
  S.split = function (segs, i, wordIndex) {
    var s = segs[i], w = s.words && s.words.length ? s.words : S.spread(s.text, s.start, s.end);
    if (wordIndex <= 0 || wordIndex >= w.length) return segs;
    var a = w.slice(0, wordIndex), b = w.slice(wordIndex);
    var A = { start: a[0].start, end: a[a.length - 1].end, words: a, text: a.map(function (x) { return x.text; }).join(" ") };
    var B = { start: b[0].start, end: s.end, words: b, text: b.map(function (x) { return x.text; }).join(" ") };
    var out = segs.slice(0, i).concat([A, B], segs.slice(i + 1)); return S.reindex(out);
  };
  S.merge = function (segs, i) {
    if (i + 1 >= segs.length) return segs;
    var a = segs[i], b = segs[i + 1];
    var m = { start: a.start, end: b.end, text: a.text + " " + b.text, words: (a.words || []).concat(b.words || []) };
    return S.reindex(segs.slice(0, i).concat([m], segs.slice(i + 2)));
  };
  S.remove = function (segs, i) { return S.reindex(segs.filter(function (_, k) { return k !== i; })); };
  S.shift = function (segs, dt) {
    return segs.map(function (s) {
      return Object.assign({}, s, { start: Math.max(0, s.start + dt), end: Math.max(0, s.end + dt),
        words: (s.words || []).map(function (w) { return Object.assign({}, w, { start: Math.max(0, w.start + dt), end: Math.max(0, w.end + dt) }); }) });
    });
  };
  S.replaceAll = function (segs, find, repl, matchCase) {
    if (!find) return segs;
    var re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), matchCase ? "g" : "gi");
    return segs.map(function (s) {
      var t = s.text.replace(re, repl);
      return t === s.text ? s : Object.assign({}, s, { text: t, words: S.spread(t, s.start, s.end) });
    });
  };

  /* subtitles */
  function pad(n, l) { n = String(n); while (n.length < l) n = "0" + n; return n; }
  S.ts = function (t, sep) {
    var ms = Math.round(Math.max(0, t) * 1000), h = Math.floor(ms / 3600000); ms -= h * 3600000;
    var m = Math.floor(ms / 60000); ms -= m * 60000; var s = Math.floor(ms / 1000); ms -= s * 1000;
    return pad(h, 2) + ":" + pad(m, 2) + ":" + pad(s, 2) + sep + pad(ms, 3);
  };
  function parseTs(x) {
    var m = /^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/.exec(x.trim());
    if (!m) throw new Error("bad timestamp " + x);
    return (+m[1] || 0) * 3600 + (+m[2]) * 60 + (+m[3]) + parseInt((m[4] + "00").slice(0, 3), 10) / 1000;
  }
  S.parseSubtitles = function (text) {
    var out = [];
    String(text).replace(/\r\n/g, "\n").replace(/^\uFEFF/, "").trim().split(/\n\s*\n/).forEach(function (block) {
      var lines = block.split("\n").filter(function (l) { return l.trim(); });
      var idx = -1; for (var i = 0; i < lines.length; i++) if (lines[i].indexOf("-->") > -1) { idx = i; break; }
      if (idx < 0) return;
      var parts = lines[idx].split("-->");
      var seg = { id: out.length + 1, start: parseTs(parts[0]), end: parseTs(parts[1].trim().split(/\s+/)[0]),
        text: clean(lines.slice(idx + 1).join(" ")), words: [] };
      seg.words = S.spread(seg.text, seg.start, seg.end);
      out.push(seg);
    });
    return out;
  };
})(typeof window !== "undefined" ? window : globalThis);
