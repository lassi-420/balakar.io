/* Wires kk-features.html to the modules. Call KK.ui.init(extensionRootPath) once the panel loads. */
(function (g) {
  var KK = (g.KK = g.KK || {});
  var U = (KK.ui = { state: { items: [], active: -1, segments: [], language: "hi", translatedFor: null } });
  var $ = function (id) { return document.getElementById(id); };
  var S = function () { return KK.segments; };

  function log(msg, bad) {
    var el = $("kk-log"); el.textContent = (bad ? "! " : "") + msg + "\n" + el.textContent.slice(0, 1500);
  }
  function guard(fn) { return function () { var a = arguments; return Promise.resolve().then(function () { return fn.apply(null, a); }).catch(function (e) { log(e.message, true); }); }; }
  function opt(sel, v, t) { var o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); }

  function styleFromUi() {
    var num = function (id) { var v = $(id).value; return v === "" ? null : +v; };
    var o = { font: $("kk-font").value || null, fontSize: num("kk-size"), strokeWidth: num("kk-strokew"),
      animation: $("kk-anim").value || null };
    if ($("kk-fill").dataset.touched) o.fill = $("kk-fill").value;
    if ($("kk-stroke").dataset.touched) o.stroke = $("kk-stroke").value;
    if ($("kk-hl").dataset.touched) o.highlight = { color: $("kk-hl").value };
    if (num("kk-posy") !== null) o.posY = num("kk-posy") / 100;
    return KK.templates.resolve($("kk-template").value, o, U.state.language);
  }
  function groupOpts() { return { maxChars: +$("kk-maxchars").value, maxWords: +$("kk-maxwords").value, maxDuration: +$("kk-maxdur").value }; }

  function setSegments(segs) { U.state.segments = S().reindex(segs); renderEditor(); }
  function renderEditor() {
    var box = $("kk-editor"); box.innerHTML = "";
    var rtl = (KK.lang(U.state.language) || {}).rtl;
    U.state.segments.forEach(function (s, i) {
      var row = document.createElement("div"); row.className = "kk-seg";
      var t = document.createElement("span"); t.className = "t"; t.textContent = S().ts(s.start, ".").slice(3, 10);
      var inp = document.createElement("input"); inp.value = s.text; if (rtl) inp.className = "kk-rtl";
      inp.onchange = function () { U.state.segments = S().setText(U.state.segments, i, inp.value); };
      var ops = document.createElement("span");
      [["split", "÷", function () { U.state.segments = S().split(U.state.segments, i, Math.ceil((s.words.length || 2) / 2)); renderEditor(); }],
       ["merge", "+", function () { U.state.segments = S().merge(U.state.segments, i); renderEditor(); }],
       ["del", "×", function () { U.state.segments = S().remove(U.state.segments, i); renderEditor(); }]].forEach(function (b) {
        var bt = document.createElement("button"); bt.textContent = b[1]; bt.title = b[0]; bt.onclick = b[2]; ops.appendChild(bt);
      });
      row.appendChild(t); row.appendChild(inp); row.appendChild(ops); box.appendChild(row);
    });
  }
  function renderQueue() {
    var ul = $("kk-queue"); ul.innerHTML = "";
    KK.batch.items.forEach(function (it) {
      var li = document.createElement("li");
      li.innerHTML = "<span></span><span></span>"; li.children[0].textContent = it.name;
      li.children[1].textContent = it.status === "running" ? Math.round(it.progress * 100) + "% " + it.stage : (it.error ? "error" : it.status);
      if (it.error) li.title = it.error; ul.appendChild(li);
    });
    var sel = $("kk-item"); var prev = sel.value; sel.innerHTML = "";
    KK.batch.items.forEach(function (it, i) { if (it.segments) opt(sel, i, it.name); });
    if (prev) sel.value = prev;
  }
  function loadItem(i) {
    var it = KK.batch.items[i]; if (!it || !it.segments) return;
    U.state.active = i; setSegments(it.segments.slice());
  }

  U.init = function (extRoot) {
    var B = KK.bridge; B.init();
    KK.languages.forEach(function (l) { opt($("kk-lang"), l.code, l.name + (l.whisper ? "" : " (needs custom model)")); });
    opt($("kk-lang"), "auto", "Auto-detect");
    KK.templates.list.forEach(function (t) { opt($("kk-template"), t.id, t.name); });
    ["fill", "stroke", "hl"].forEach(function (k) { $("kk-" + k).addEventListener("input", function () { this.dataset.touched = "1"; }); });
    $("kk-lang").onchange = function () { U.state.language = this.value; renderEditor(); };
    U.state.language = $("kk-lang").value;
    KK.batch.onChange = renderQueue;

    B.loadJsx(extRoot).then(B.home).then(function (home) { KK.api.loadToken(home); return KK.api.health(); }).then(function (h) {
      $("kk-root").classList.add("kk-ok");
      $("kk-status-text").textContent = "Local engine ready · " + h.model + (h.cuda ? " · GPU" : " · CPU") + (h.ffmpeg ? "" : " · ffmpeg MISSING");
      h.translationTargets.forEach(function (c) { opt($("kk-translate-to"), c, c); });
    }).catch(function (e) { $("kk-status-text").textContent = "Engine offline - open Start Menu > Balakar > Start Engine. (" + e.message + ")"; });

    $("kk-add-sel").onclick = guard(function () { return B.call({ action: "media" }).then(function (r) { KK.batch.add([r.path]); }); });
    $("kk-add-files").onclick = guard(function () {
      var f = KK.exporters.openDialog("Choose audio/video", ["mp4", "mov", "mkv", "mp3", "wav", "m4a", "aac", "flac", "ogg", "webm"], true);
      if (f.length) KK.batch.add(f);
    });
    $("kk-clear").onclick = function () { KK.batch.clear(); };
    $("kk-run").onclick = guard(function () {
      var lang = $("kk-lang").value;
      return KK.batch.run({ language: lang, task: $("kk-task").value, script: $("kk-latin").checked ? "latin" : null,
        group: { max_chars: +$("kk-maxchars").value, max_words: +$("kk-maxwords").value, max_duration: +$("kk-maxdur").value },
        translateTo: $("kk-translate-to").value || null,
        enhance: $("kk-enhance-first").checked ? { preset: $("kk-enh-preset").value, engine: $("kk-enh-engine").value } : null
      }).then(function () {
        var first = KK.batch.items.findIndex(function (i) { return i.segments; });
        if (first > -1) { $("kk-item").value = first; loadItem(first); }
        KK.batch.items.forEach(function (i) { (i.warnings || []).forEach(function (w) { log(w, true); }); });
        log("Transcription finished.");
      });
    });
    $("kk-item").onchange = function () { loadItem(+this.value); };
    $("kk-regroup").onclick = function () { setSegments(S().regroup(U.state.segments, groupOpts())); };
    $("kk-replace-all").onclick = function () { setSegments(S().replaceAll(U.state.segments, $("kk-find").value, $("kk-repl").value, false)); };
    $("kk-shift-btn").onclick = function () { setSegments(S().shift(U.state.segments, +$("kk-shift").value)); };

    function build(action) {
      var st = styleFromUi();
      var p = { action: action, segments: U.state.segments, style: st, replace: action === "build", language: U.state.language, applyToAll: $("kk-apply-all").checked };
      return B.call(p).then(function (r) {
        log((r.layers || 0) + " caption layers" + (r.warnings && r.warnings.length ? " · " + r.warnings.length + " warnings: " + r.warnings[0] : ""));
        if (r.note) log(r.note);
      });
    }
    $("kk-build").onclick = guard(function () {
      if (!U.state.segments.length) throw new Error("Nothing to build - transcribe or import first.");
      var it = KK.batch.items[U.state.active]; var off = 0;
      return B.call({ action: "media" }).then(function (m) { off = (it && it.path === m.path) ? m.offset : 0; }, function () {})
        .then(function () {
          var st = styleFromUi();
          return B.call({ action: "build", segments: U.state.segments, style: st, replace: true, offset: off, language: U.state.language });
        }).then(function (r) { log(r.layers + " caption layers built" + (r.note ? "\n" + r.note : "")); });
    });
    $("kk-restyle").onclick = guard(function () { return build("restyle"); });
    $("kk-pull").onclick = guard(function () { return B.call({ action: "read" }).then(function (r) { setSegments(r.segments); log("Read " + r.segments.length + " captions from AE."); }); });
    $("kk-remove").onclick = guard(function () { return B.call({ action: "remove" }).then(function (r) { log("Removed " + r.removed + " layers."); }); });

    $("kk-font-install").onclick = guard(function () {
      var f = KK.exporters.openDialog("Choose a font", ["ttf", "otf", "ttc"], false)[0]; if (!f) return;
      return KK.api.installFont(f).then(function (r) {
        if (r.postscriptName || r.postscriptName === null) $("kk-font").value = r.postscriptName || "";
        log("Font installed. Restart After Effects to use it. PostScript name: " + (r.postscriptName || "(install fontTools to detect)"));
      });
    });
    $("kk-tpl-import").onclick = guard(function () {
      var f = KK.exporters.openDialog("Template JSON", ["json"], false)[0]; if (!f) return;
      KK.templates.importJson(KK.exporters.read(f)); $("kk-template").innerHTML = "";
      KK.templates.list.forEach(function (t) { opt($("kk-template"), t.id, t.name); }); log("Templates imported.");
    });
    $("kk-tpl-export").onclick = guard(function () {
      var p = KK.exporters.saveDialog("Save templates", "kk-templates.json", ["json"]); if (p) return KK.exporters.save(p, KK.templates.exportJson());
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-fmt]"), function (b) {
      b.onclick = guard(function () {
        var fmt = b.dataset.fmt, p = KK.exporters.saveDialog("Export " + fmt.toUpperCase(), "captions." + fmt, [fmt]);
        if (!p) return;
        if (fmt === "docx") return KK.api.exportFile("docx", U.state.segments, p, { language: U.state.language }).then(function () { log("Saved " + p); });
        return KK.exporters.save(p, KK.exporters.build(fmt, U.state.segments)).then(function () { log("Saved " + p); });
      });
    });
    $("kk-import-sub").onclick = guard(function () {
      var f = KK.exporters.openDialog("SRT / VTT", ["srt", "vtt"], false)[0]; if (!f) return;
      setSegments(S().parseSubtitles(KK.exporters.read(f))); log("Imported " + U.state.segments.length + " captions.");
    });
    $("kk-use-translated").onclick = function () {
      var it = KK.batch.items[U.state.active]; if (!it || !it.translated) return log("No translation for this item.", true);
      U.state.language = $("kk-translate-to").value || "en"; setSegments(it.translated.slice());
    };

    $("kk-render").onclick = guard(function () {
      var fps = $("kk-fps").value;
      return B.call({ action: "render", mode: $("kk-render-mode").value, frameRate: fps ? +fps : null, template: $("kk-om").value || null })
        .then(function (r) { log("Queued in render queue." + (r.chromaBackground ? " Chroma background added (remove after rendering)." : "") + (r.warnings.length ? "\n" + r.warnings.join("\n") : "")); });
    });
    $("kk-chroma-off").onclick = guard(function () { return B.call({ action: "removeChroma" }).then(function (r) { log("Removed " + r.removed + " chroma layer(s)."); }); });

    $("kk-enhance").onclick = guard(function () {
      return B.call({ action: "media" }).then(function (m) {
        log("Enhancing " + m.name + "...");
        return KK.api.enhance(m.path, { preset: $("kk-enh-preset").value, engine: $("kk-enh-engine").value }, function (p, s) { $("kk-status-text").textContent = "Enhancing " + Math.round(p * 100) + "% " + s; })
          .then(function (r) { return B.call({ action: "importAudio", path: r.output, startTime: m.offset, muteOriginal: $("kk-mute-orig").checked }); });
      }).then(function () { log("Enhanced audio added to the comp."); });
    });
  };
})(typeof window !== "undefined" ? window : globalThis);
