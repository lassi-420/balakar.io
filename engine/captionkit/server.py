"""Local HTTP API for the panel. Binds to 127.0.0.1 only and requires a per-run token."""
import json
import os
import secrets
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import __version__, config, exporters
from .jobs import Jobs
from .languages import NLLB, languages_payload

TOKEN_DIR = os.path.join(os.path.expanduser("~"), ".captionkit")
TOKEN_FILE = os.path.join(TOKEN_DIR, "token")


class App:
    def __init__(self, cfg):
        self.cfg = cfg
        self.jobs = Jobs()
        self._asr = None
        self._tr = None

    @property
    def asr(self):
        if self._asr is None:
            from .asr import WhisperEngine
            self._asr = WhisperEngine(self.cfg)
        return self._asr

    @property
    def tr(self):
        if self._tr is None:
            from .translate import Translator
            self._tr = Translator(self.cfg)
        return self._tr

    # ---- handlers (each returns JSON-serialisable) ----
    def health(self, _):
        import shutil
        ff = shutil.which(self.cfg["ffmpeg"]) or (self.cfg["ffmpeg"] if os.path.isfile(self.cfg["ffmpeg"]) else None)
        info = {"ok": True, "version": __version__, "ffmpeg": bool(ff), "model": self.cfg["whisper_model"],
                "modelOverrides": self.cfg.get("model_overrides", {}), "languages": languages_payload(),
                "translationTargets": sorted(NLLB.keys()), "offline": self.cfg["offline"]}
        try:
            import torch
            info["cuda"] = torch.cuda.is_available()
        except Exception:
            info["cuda"] = None
        return info

    def transcribe(self, b):
        def run(progress):
            return self.asr.transcribe(
                b["path"], language=b.get("language"), task=b.get("task", "transcribe"),
                model=b.get("model"), script=b.get("script"), prompt=b.get("prompt"),
                group=b.get("group"), progress=progress)
        return {"job": self.jobs.submit(lambda progress: run(progress))}

    def translate(self, b):
        def run(progress):
            return {"segments": self.tr.translate_segments(
                b["segments"], b["source"], b["target"], b.get("model"), progress)}
        return {"job": self.jobs.submit(lambda progress: run(progress))}

    def enhance(self, b):
        from .enhance import enhance

        def run(progress):
            progress(0.1, "enhancing")
            return enhance(b["path"], b.get("output"), b.get("engine", "ffmpeg"),
                           b.get("preset", "standard"), self.cfg["ffmpeg"], b.get("rnnoiseModel"),
                           b.get("loudnorm", True))
        return {"job": self.jobs.submit(lambda progress: run(progress))}

    def export(self, b):
        data = exporters.export(b["format"], b["segments"], b.get("path"), title=b.get("title", "Transcript"),
                                lang=b.get("language"), timestamps=b.get("timestamps", True))
        return {"path": b.get("path"), "bytes": len(data)}

    def parse(self, b):
        return {"segments": exporters.parse_subtitles(b["text"])}

    def install_font(self, b):
        from .fonts import install_font
        return install_font(b["path"])

    def job(self, jid):
        j = self.jobs.get(jid)
        return j if j else None


def make_handler(app, token):
    routes = {"/transcribe": app.transcribe, "/translate": app.translate, "/enhance": app.enhance,
              "/export": app.export, "/parse": app.parse, "/fonts/install": app.install_font}

    class H(BaseHTTPRequestHandler):
        server_version = "CaptionKit/" + __version__

        def log_message(self, *a):
            pass

        def _send(self, code, obj):
            raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-KK-Token")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def _authed(self):
            return secrets.compare_digest(self.headers.get("X-KK-Token", ""), token)

        def do_OPTIONS(self):
            self._send(204, {})

        def do_GET(self):
            if self.path == "/health":
                return self._send(200, app.health(None))
            if not self._authed():
                return self._send(401, {"error": "bad token"})
            if self.path.startswith("/jobs/"):
                j = app.job(self.path.split("/")[2])
                return self._send(200, j) if j else self._send(404, {"error": "no such job"})
            self._send(404, {"error": "not found"})

        def do_POST(self):
            if not self._authed():
                return self._send(401, {"error": "bad token"})
            fn = routes.get(self.path)
            if not fn:
                return self._send(404, {"error": "not found"})
            try:
                n = int(self.headers.get("Content-Length", "0"))
                body = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
                self._send(200, fn(body))
            except Exception as e:  # noqa
                self._send(400, {"error": "%s: %s" % (type(e).__name__, e)})

    return H


def main(argv=None):
    cfg = config.load()
    token = secrets.token_urlsafe(24)
    os.makedirs(TOKEN_DIR, exist_ok=True)
    with open(TOKEN_FILE, "w") as f:
        f.write(token)
    try:
        os.chmod(TOKEN_FILE, 0o600)
    except OSError:
        pass
    app = App(cfg)
    srv = ThreadingHTTPServer((cfg["host"], cfg["port"]), make_handler(app, token))
    print("CaptionKit %s listening on http://%s:%d  (token in %s)" % (
        __version__, cfg["host"], cfg["port"], TOKEN_FILE), flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    sys.exit(main())
