// kk-captions.jsx - After Effects ExtendScript layer for ae-caption-kit.
// ES3 only (no let/const/forEach/JSON). Entry point from the panel: KK.runFile(path-to-payload.json)
// Every action returns a JSON string: {ok:true,...} or {error:"..."}.

#target aftereffects
var KK = (typeof KK === "undefined") ? {} : KK;

(function () {
  // ---------- tiny JSON (AE's ExtendScript has none) ----------
  function jstr(v) {
    var t = typeof v, i, out;
    if (v === null || v === undefined) return "null";
    if (t === "number") return isFinite(v) ? String(v) : "null";
    if (t === "boolean") return String(v);
    if (t === "string") {
      return '"' + v.replace(/[\\"\u0000-\u001f\u2028\u2029]/g, function (c) {
        var m = { "\\": "\\\\", '"': '\\"', "\n": "\\n", "\r": "\\r", "\t": "\\t" };
        return m[c] || "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
      }) + '"';
    }
    if (v instanceof Array) { out = []; for (i = 0; i < v.length; i++) out.push(jstr(v[i])); return "[" + out.join(",") + "]"; }
    out = []; for (var k in v) if (v.hasOwnProperty(k) && typeof v[k] !== "function") out.push(jstr(k) + ":" + jstr(v[k]));
    return "{" + out.join(",") + "}";
  }
  function jparse(s) {
    // payloads are written by our own panel; guard against anything that is not plain JSON
    if (/[^,:{}\[\]0-9.\-+Eaeflnr-uw \n\r\t]/.test(s.replace(/"(\\.|[^"\\])*"/g, ""))) throw new Error("invalid JSON payload");
    return eval("(" + s + ")");
  }
  KK.jstr = jstr; KK.jparse = jparse;

  var TAG = "KK_CAPTION";

  function activeComp() {
    var c = app.project.activeItem;
    if (!(c instanceof CompItem)) throw new Error("Open or select a composition first.");
    return c;
  }
  function rgb(h) {
    h = String(h).replace("#", "");
    return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
  }
  function alphaOf(h) { h = String(h).replace("#", ""); return h.length >= 8 ? parseInt(h.substr(6, 2), 16) / 255 : 1; }
  function pad(n, l) { n = String(n); while (n.length < l) n = "0" + n; return n; }
  function readText(path) {
    var f = new File(path); f.encoding = "UTF-8";
    if (!f.open("r")) throw new Error("Cannot open " + path);
    var s = f.read(); f.close(); return s;
  }

  // ---------- expressions ----------
  var FIT = "var r=thisLayer.sourceRectAtTime(time,false);var fit=Math.min(100,thisComp.width*MAXW/Math.max(r.width,1)*100);";
  function scaleExpr(anim, maxW) {
    var head = FIT.replace("MAXW", String(maxW)) + "var t=time-inPoint;";
    if (anim === "pop") {
      return head + "var k=t<0.10?linear(t,0,0.10,55,112):(t<0.18?linear(t,0.10,0.18,112,100):100);" +
             "[fit*k/100,fit*k/100]";
    }
    return head + "[fit,fit]";
  }
  function opacityExpr(anim) {
    if (anim === "fade" || anim === "slideUp" || anim === "pop") return "var t=time-inPoint;linear(t,0,0.10,0,100)";
    return null;
  }
  function positionExpr(anim) {
    if (anim === "slideUp") return "var t=time-inPoint;value+[0,ease(t,0,0.18,48,0)]";
    return null;
  }

  // ---------- text styling ----------
  function styleDoc(layer, text, st) {
    var prop = layer.property("ADBE Text Properties").property("ADBE Text Document");
    var td = prop.value;
    td.resetCharStyle();
    td.text = text;
    try { td.font = st.font; } catch (e) { /* font missing: AE keeps default */ }
    td.fontSize = st.fontSize;
    td.applyFill = true;
    td.fillColor = rgb(st.fill);
    if (st.stroke && st.strokeWidth > 0) {
      td.applyStroke = true; td.strokeColor = rgb(st.stroke); td.strokeWidth = st.strokeWidth; td.strokeOverFill = false;
    } else { td.applyStroke = false; }
    td.justification = ParagraphJustification.CENTER_JUSTIFY;
    try { td.tracking = st.tracking || 0; } catch (e2) {}
    prop.setValue(td);
  }

  function highlightExpr(times, cumulative) {
    var arr = "[" + times.join(",") + "]";
    var base = "var T=" + arr + ";var n=0;for(var i=0;i<T.length;i++){if(time>=T[i])n=i+1;}";
    return {
      start: base + (cumulative ? "0" : "Math.max(n-1,0)"),
      end: base + "n"
    };
  }

  // Active-word highlight: text animator with an expression-driven range selector (Words, Index units)
  function addHighlight(layer, hl, times) {
    var ex = highlightExpr(times, hl.mode === "cumulative");
    var anim = layer.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");
    anim.name = "KK Highlight";
    var props = anim.property("ADBE Text Animator Properties");
    props.addProperty("ADBE Text Fill Color").setValue(rgb(hl.color));
    if (hl.scale && hl.scale !== 100) props.addProperty("ADBE Text Scale 3D").setValue([hl.scale, hl.scale, hl.scale]);
    var sel = anim.property("ADBE Text Selectors").property(1);           // Range Selector 1
    sel.property("ADBE Text Range Type2").setValue(3);                    // Based On: Words
    sel.property("ADBE Text Range Units").setValue(2);                    // Units: Index
    sel.property("ADBE Text Index Start").expression = ex.start;
    sel.property("ADBE Text Index End").expression = ex.end;
  }

  function addTypewriter(layer) {
    var anim = layer.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");
    anim.name = "KK Typewriter";
    anim.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity").setValue(0);
    var sel = anim.property("ADBE Text Selectors").property(1);
    sel.property("ADBE Text Percent Start").expression =
      "linear(time-inPoint,0,Math.max((outPoint-inPoint)*0.55,0.2),0,100)";
  }

  function addBox(comp, textLayer, st, idx) {
    var b = st.box;
    var shape = comp.layers.addShape();
    shape.name = "KK BG " + pad(idx, 3);
    var grp = shape.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    var cont = grp.property("ADBE Vectors Group");
    var rect = cont.addProperty("ADBE Vector Shape - Rect");
    var tn = textLayer.name.replace(/"/g, '\\"');
    var L = 'var L=thisComp.layer("' + tn + '");var r=L.sourceRectAtTime(time,false);var s=L.transform.scale[0]/100;';
    rect.property("ADBE Vector Rect Size").expression =
      L + "[r.width*s+" + (b.padX * 2) + ",r.height*s+" + (b.padY * 2) + "]";
    rect.property("ADBE Vector Rect Roundness").setValue(b.radius);
    var fill = cont.addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue(rgb(b.color));
    fill.property("ADBE Vector Fill Opacity").setValue((b.opacity == null ? 100 : b.opacity) * alphaOf(b.color));
    shape.property("ADBE Transform Group").property("ADBE Position").expression =
      'thisComp.layer("' + tn + '").transform.position';
    shape.property("ADBE Transform Group").property("ADBE Opacity").expression =
      'thisComp.layer("' + tn + '").transform.opacity';
    shape.startTime = 0; shape.inPoint = textLayer.inPoint; shape.outPoint = textLayer.outPoint;
    shape.comment = "KK_BG" + idx;
    shape.moveAfter(textLayer);
    return shape;
  }

  function makeLayer(comp, text, st, inT, outT, idx, tagData, times) {
    var layer = comp.layers.addText(text);
    layer.name = "KK " + pad(idx, 3) + " " + text.substr(0, 24);
    layer.startTime = 0;
    styleDoc(layer, st.uppercase ? text.toUpperCase() : text, st);
    layer.inPoint = inT; layer.outPoint = outT;
    var tr = layer.property("ADBE Transform Group");
    tr.property("ADBE Anchor Point").expression =
      "var r=sourceRectAtTime(time,false);[r.left+r.width/2,r.top+r.height/2]";
    tr.property("ADBE Position").setValue([comp.width / 2, comp.height * st.posY]);
    var pe = positionExpr(st.animation);
    if (pe) tr.property("ADBE Position").expression = pe;
    tr.property("ADBE Scale").expression = scaleExpr(st.animation, st.maxWidth || 0.9);
    var oe = opacityExpr(st.animation);
    if (oe) tr.property("ADBE Opacity").expression = oe;
    if (st.animation === "typewriter") addTypewriter(layer);
    if (st.mode === "highlight" && times && times.length && st.highlight) addHighlight(layer, st.highlight, times);
    if (st.box) addBox(comp, layer, st, tagData.i);
    layer.comment = TAG + jstr(tagData);
    return layer;
  }

  function tagOf(layer) {
    var c = layer.comment || "";
    if (c.indexOf(TAG) !== 0) return null;
    try { return jparse(c.substr(TAG.length)); } catch (e) { return null; }
  }

  function gid(t) { return t.m === "word" ? Math.floor(t.i / 100) : t.i; }

  function removeCaptionLayers(comp, only) {
    var n = 0, gone = {}, i, l, t;
    for (i = comp.numLayers; i >= 1; i--) {
      l = comp.layer(i); t = tagOf(l);
      if (t && (!only || only[gid(t)])) { gone[t.i] = true; l.remove(); n++; }
    }
    for (i = comp.numLayers; i >= 1; i--) {
      l = comp.layer(i);
      if ((l.comment || "").indexOf("KK_BG") === 0 && gone[parseInt(l.comment.substr(5), 10)]) { l.remove(); n++; }
    }
    return n;
  }

  // ---------- actions ----------
  var A = {};

  A.build = function (p) {
    var comp = activeComp(), st = p.style, segs = p.segments, made = 0, warn = [];
    var offset = p.offset || 0;
    app.beginUndoGroup("KK Build Captions");
    try {
      if (p.replace) removeCaptionLayers(comp, null);
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i], idx = s.id || (i + 1);
        var inT = s.start + offset, outT = Math.max(s.end + offset, inT + 0.1);
        var words = s.words || [];
        try {
          if (st.mode === "word" && words.length) {
            for (var w = 0; w < words.length; w++) {
              var wi = words[w], wIn = wi.start + offset, wOut = Math.max(wi.end + offset, wIn + 0.1);
              if (w + 1 < words.length) wOut = Math.max(Math.min(wOut, words[w + 1].start + offset), wIn + 0.05);
              makeLayer(comp, wi.text, st, wIn, wOut, idx * 100 + w, { i: idx * 100 + w, s: wIn, e: wOut, m: "word" }, null);
              made++;
            }
          } else {
            var times = [], wd = [], w2;
            for (w2 = 0; w2 < words.length; w2++) { times.push(Math.round((words[w2].start + offset) * 1000) / 1000); wd.push([words[w2].text, words[w2].start, words[w2].end]); }
            var layer = makeLayer(comp, s.text, st, inT, outT, idx, { i: idx, s: inT, e: outT, m: st.mode, w: wd, l: p.language || "" }, times);
            made++;
          }
        } catch (e) {
          // fallback: plain line without animators/boxes, so one bad feature never kills the batch
          warn.push("segment " + idx + ": " + e.toString());
          var st2 = {}; for (var k in st) st2[k] = st[k]; st2.mode = "line"; st2.box = null; st2.animation = "none";
          makeLayer(comp, s.text, st2, inT, outT, idx, { i: idx, s: inT, e: outT, m: "line" }, null); made++;
        }
      }
    } finally { app.endUndoGroup(); }
    var rtlNote = st.rtl ? "RTL/Indic script: set Preferences > Type > Text Engine to 'South Asian and Middle Eastern' so Urdu/Arabic/Hindi shape correctly." : "";
    return { ok: true, layers: made, warnings: warn, note: rtlNote };
  };

  // Re-apply a style to tagged caption layers ("Apply to All Layers" = no selection filter).
  A.restyle = function (p) {
    var comp = activeComp(), segs = A.read({}).segments, only = null;
    if (!p.applyToAll) {
      only = {};
      for (var i = 0; i < comp.selectedLayers.length; i++) { var t = tagOf(comp.selectedLayers[i]); if (t) only[gid(t)] = true; }
      var any = false; for (var k in only) { any = true; break; }
      if (!any) throw new Error("Select caption layers, or enable 'Apply to all layers'.");
      var sub = []; for (var j = 0; j < segs.length; j++) if (only[segs[j].id]) sub.push(segs[j]);
      segs = sub;
    }
    app.beginUndoGroup("KK Restyle");
    try { removeCaptionLayers(comp, only); } finally { app.endUndoGroup(); }
    return A.build({ segments: segs, style: p.style, replace: false, language: p.language });
  };

  // Read tagged layers back (captures edits made directly in AE).
  A.read = function (p) {
    var comp = activeComp(), out = [], groups = {}, order = [], i, w;
    for (i = 1; i <= comp.numLayers; i++) {
      var l = comp.layer(i), t = tagOf(l);
      if (!t) continue;
      var txt = String(l.property("ADBE Text Properties").property("ADBE Text Document").value.text).replace(/\s+/g, " ");
      if (t.m === "word") {
        var g = gid(t);
        if (!groups[g]) { groups[g] = []; order.push(g); }
        groups[g].push({ text: txt, start: l.inPoint, end: l.outPoint });
        continue;
      }
      var words = [], base = "";
      if (t.w) {
        var a = [];
        for (w = 0; w < t.w.length; w++) { words.push({ text: t.w[w][0], start: t.w[w][1], end: t.w[w][2] }); a.push(t.w[w][0]); }
        base = a.join(" ");
      }
      if (base && txt.toUpperCase() !== base.toUpperCase()) words = [];   // edited in AE: drop stale word timing
      out.push({ id: t.i, start: l.inPoint, end: l.outPoint, text: txt, words: words });
    }
    for (i = 0; i < order.length; i++) {
      var ws = groups[order[i]];
      ws.sort(function (x, y) { return x.start - y.start; });
      var tx = []; for (w = 0; w < ws.length; w++) tx.push(ws[w].text);
      out.push({ id: order[i], start: ws[0].start, end: ws[ws.length - 1].end, text: tx.join(" "), words: ws });
    }
    out.sort(function (x, y) { return x.start - y.start; });
    return { ok: true, segments: out };
  };

  A.remove = function (p) { var n = removeCaptionLayers(activeComp(), null); return { ok: true, removed: n }; };

  A.media = function (p) {
    var comp = activeComp(), sel = comp.selectedLayers;
    for (var i = 0; i < sel.length; i++) {
      var src = sel[i].source;
      if (src && src.mainSource && src.mainSource.file) return { ok: true, path: src.mainSource.file.fsName, name: sel[i].name, offset: sel[i].startTime };
    }
    for (var j = 1; j <= comp.numLayers; j++) {
      var s2 = comp.layer(j).source;
      if (s2 && s2.mainSource && s2.mainSource.file && s2.hasAudio) return { ok: true, path: s2.mainSource.file.fsName, name: comp.layer(j).name, offset: 0 };
    }
    throw new Error("Select a footage/audio layer in the composition.");
  };

  A.importAudio = function (p) {
    var comp = activeComp();
    app.beginUndoGroup("KK Import Enhanced Audio");
    try {
      var item = app.project.importFile(new ImportOptions(new File(p.path)));
      var layer = comp.layers.add(item); layer.startTime = p.startTime || 0; layer.name = "KK Enhanced Audio";
      if (p.muteOriginal) {
        for (var i = 1; i <= comp.numLayers; i++) { var l = comp.layer(i); if (l !== layer && l.hasAudio && l.source && l.source.hasVideo) l.audioEnabled = false; }
      }
    } finally { app.endUndoGroup(); }
    return { ok: true };
  };

  // Render queue: alpha | green | blue | plain. Output Module templates vary by AE install/locale,
  // so the template name is configurable and failures are reported, not swallowed.
  A.render = function (p) {
    var comp = activeComp(), bg = null, warn = [];
    var chroma = { green: [0, 177 / 255, 64 / 255], blue: [0, 71 / 255, 187 / 255] };
    app.beginUndoGroup("KK Render Setup");
    try {
      if (p.mode === "green" || p.mode === "blue") {
        bg = comp.layers.addSolid(chroma[p.mode], "KK_CHROMA_BG", comp.width, comp.height, comp.pixelAspect, comp.duration);
        bg.moveToEnd();
      }
      var rq = app.project.renderQueue.items.add(comp);
      var om = rq.outputModule(1);
      var tpl = p.template || (p.mode === "alpha" ? "Lossless with Alpha" : "Lossless");
      try { om.applyTemplate(tpl); } catch (e) { warn.push("Output Module template '" + tpl + "' not found: " + e.toString()); }
      if (p.mode === "alpha") { try { om.setSettings({ "Channels": "RGB + Alpha" }); } catch (e2) { warn.push("Could not force Alpha channel: " + e2.toString()); } }
      if (p.frameRate) { try { rq.setSettings({ "Use this frame rate": true, "Frame Rate": p.frameRate }); } catch (e3) { warn.push("Frame rate override failed: " + e3.toString()); } }
      if (p.output) { om.file = new File(p.output); }
      if (p.renderNow) { app.project.renderQueue.render(); if (bg) bg.remove(); }
    } finally { app.endUndoGroup(); }
    return { ok: true, chromaBackground: !!bg && !p.renderNow, warnings: warn };
  };
  A.removeChroma = function () {
    var comp = activeComp(), n = 0;
    for (var i = comp.numLayers; i >= 1; i--) if (comp.layer(i).name === "KK_CHROMA_BG") { comp.layer(i).remove(); n++; }
    return { ok: true, removed: n };
  };

  A.ping = function () { return { ok: true, ae: app.version }; };

  KK.home = function () { return Folder("~").fsName; };
  KK.runFile = function (path) {
    try {
      var p = jparse(readText(path));
      var fn = A[p.action];
      if (!fn) return jstr({ error: "unknown action " + p.action });
      return jstr(fn(p));
    } catch (e) { return jstr({ error: e.toString() }); }
  };
  KK._actions = A;
})();
