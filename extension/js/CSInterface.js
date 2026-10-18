/* Minimal CEP bridge (MIT, written for Balakar). Implements only what this project uses:
   evalScript + getSystemPath. If you merge into a plugin that already ships Adobe's
   CSInterface.js, delete this file - the API used here is identical. */
(function (g) {
  if (g.CSInterface) return;
  g.SystemPath = { USER_DATA: "userData", COMMON_FILES: "commonFiles", MY_DOCUMENTS: "myDocuments",
    APPLICATION: "application", EXTENSION: "extension", HOST_APPLICATION: "hostApplication" };
  g.CSInterface = function () {};
  g.CSInterface.prototype.evalScript = function (script, cb) {
    g.__adobe_cep__.evalScript(script, cb || function () {});
  };
  g.CSInterface.prototype.getSystemPath = function (type) {
    var p = decodeURI(g.__adobe_cep__.getSystemPath(type));
    return /win/i.test(g.navigator.platform) ? p.replace("file:///", "") : p.replace("file://", "");
  };
})(window);
