/* Client for the local CaptionKit server. Also exposes setTranscriber() so you can keep
   your existing local-Whisper pipeline and still use every other module. */
(function (g) {
  var KK = (g.KK = g.KK || {});
  var A = (KK.api = { baseUrl: "http://127.0.0.1:8765", token: null, _transcriber: null });

  A.loadToken = function (homeDir) {
    var p = homeDir.replace(/\\/g, "/") + "/.captionkit/token";
    var r = g.cep.fs.readFile(p, g.cep.encoding.UTF8);
    if (r.err !== 0) throw new Error("Server token not found - is the backend running?");
    A.token = r.data.trim();
  };

  function req(method, path, body) {
    return fetch(A.baseUrl + path, {
      method: method,
      headers: { "Content-Type": "application/json", "X-KK-Token": A.token || "" },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.statusText); return j; });
    });
  }
  A.health = function () { return fetch(A.baseUrl + "/health").then(function (r) { return r.json(); }); };

  A.waitJob = function (id, onProgress) {
    return new Promise(function (resolve, reject) {
      (function poll() {
        req("GET", "/jobs/" + id).then(function (j) {
          if (onProgress) onProgress(j.progress, j.stage);
          if (j.status === "done") resolve(j.result);
          else if (j.status === "error") reject(new Error(j.error));
          else setTimeout(poll, 700);
        }, reject);
      })();
    });
  };
  A.run = function (path, body, onProgress) {
    return req("POST", path, body).then(function (r) { return A.waitJob(r.job, onProgress); });
  };

  /* fn(opts, onProgress) -> Promise<{segments|chunks}>  (anything KK.segments.normalize accepts) */
  A.setTranscriber = function (fn) { A._transcriber = fn; };

  A.transcribe = function (o, onProgress) {
    if (A._transcriber) {
      return A._transcriber(o, onProgress).then(function (raw) {
        return { language: o.language, model: "custom", warnings: [], segments: KK.segments.normalize(raw) };
      });
    }
    return A.run("/transcribe", o, onProgress).then(function (r) { r.segments = KK.segments.normalize(r); return r; });
  };
  A.translate = function (segments, source, target, onProgress) {
    return A.run("/translate", { segments: segments, source: source, target: target }, onProgress)
      .then(function (r) { return r.segments; });
  };
  A.enhance = function (path, o, onProgress) {
    return A.run("/enhance", Object.assign({ path: path }, o || {}), onProgress);
  };
  A.exportFile = function (format, segments, path, o) {
    return req("POST", "/export", Object.assign({ format: format, segments: segments, path: path }, o || {}));
  };
  A.installFont = function (path) { return req("POST", "/fonts/install", { path: path }); };
})(typeof window !== "undefined" ? window : globalThis);
