/* Panel <-> ExtendScript. Payloads travel through a UTF-8 temp file so Urdu/Hindi/Arabic text
   is never mangled by evalScript string escaping. Requires jsx/kk-captions.jsx to be loaded. */
(function (g) {
  var KK = (g.KK = g.KK || {});
  var B = (KK.bridge = { cs: null, tmp: null });

  B.init = function () {
    B.cs = new g.CSInterface();
    B.tmp = B.cs.getSystemPath(g.SystemPath.USER_DATA).replace(/\\/g, "/") + "/CaptionKit";
    g.cep.fs.makedir(B.tmp);
  };
  B.eval = function (script) {
    return new Promise(function (resolve) { B.cs.evalScript(script, resolve); });
  };
  B.loadJsx = function (extRoot) {
    return B.eval('$.evalFile("' + extRoot.replace(/\\/g, "/") + '/jsx/kk-captions.jsx")');
  };
  B.call = function (payload) {
    var file = B.tmp + "/payload_" + Date.now() + ".json";
    var w = g.cep.fs.writeFile(file, JSON.stringify(payload), g.cep.encoding.UTF8);
    if (w.err !== 0) return Promise.reject(new Error("cannot write payload"));
    return B.eval('KK.runFile("' + file + '")').then(function (res) {
      g.cep.fs.deleteFile(file);
      var out; try { out = JSON.parse(res); } catch (e) { throw new Error("Bad ExtendScript reply: " + res); }
      if (out && out.error) throw new Error(out.error);
      return out;
    });
  };
  B.home = function () { return B.eval("KK.home()"); };
})(typeof window !== "undefined" ? window : globalThis);
