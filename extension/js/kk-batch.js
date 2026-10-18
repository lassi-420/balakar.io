/* Unlimited batch queue: transcribe (and optionally translate) many files, one after another. */
(function (g) {
  var KK = (g.KK = g.KK || {});
  var Q = (KK.batch = { items: [], running: false, onChange: function () {} });

  Q.add = function (paths) {
    paths.forEach(function (p) {
      if (!Q.items.some(function (i) { return i.path === p; }))
        Q.items.push({ path: p, name: p.split(/[\\/]/).pop(), status: "queued", progress: 0, stage: "", segments: null, error: null });
    });
    Q.onChange();
  };
  Q.clear = function () { if (!Q.running) { Q.items = []; Q.onChange(); } };

  /* opts = { language, task, script, group, translateTo, enhance:{preset,engine}|null } */
  Q.run = function (opts) {
    if (Q.running) return Promise.resolve();
    Q.running = true;
    var chain = Promise.resolve();
    Q.items.filter(function (i) { return i.status === "queued" || i.status === "error"; }).forEach(function (item) {
      chain = chain.then(function () {
        item.status = "running"; item.error = null; Q.onChange();
        var path = item.path, pre = Promise.resolve(path);
        if (opts.enhance) {
          pre = KK.api.enhance(path, opts.enhance, function (p, s) { item.progress = p * 0.25; item.stage = s; Q.onChange(); })
            .then(function (r) { item.enhancedPath = r.output; return r.output; });
        }
        return pre.then(function (p) {
          return KK.api.transcribe({ path: p, language: opts.language, task: opts.task, script: opts.script, group: opts.group },
            function (pr, s) { item.progress = 0.25 + pr * 0.75; item.stage = s; Q.onChange(); });
        }).then(function (res) {
          item.segments = res.segments; item.warnings = res.warnings || []; item.language = res.language;
          if (opts.translateTo && opts.translateTo !== opts.language) {
            item.stage = "translating"; Q.onChange();
            return KK.api.translate(res.segments, opts.language === "auto" ? "en" : opts.language, opts.translateTo)
              .then(function (t) { item.translated = t; });
          }
        }).then(function () { item.status = "done"; item.progress = 1; })
          .catch(function (e) { item.status = "error"; item.error = e.message; })
          .then(function () { Q.onChange(); });
      });
    });
    return chain.then(function () { Q.running = false; Q.onChange(); });
  };
})(typeof window !== "undefined" ? window : globalThis);
