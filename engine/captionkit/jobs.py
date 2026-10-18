"""Tiny single-worker job queue (serialises GPU work) with progress polling."""
import threading
import time
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor


class Jobs:
    def __init__(self):
        self._pool = ThreadPoolExecutor(max_workers=1)
        self._jobs = {}
        self._lock = threading.Lock()

    def submit(self, fn, *a, **kw):
        jid = uuid.uuid4().hex[:12]
        job = {"id": jid, "status": "queued", "progress": 0.0, "stage": "queued",
               "result": None, "error": None, "created": time.time()}
        with self._lock:
            self._jobs[jid] = job

        def progress(p, stage=""):
            job["progress"], job["stage"] = float(p), stage

        def run():
            job["status"] = "running"
            try:
                job["result"] = fn(*a, progress=progress, **kw)
                job["status"], job["progress"] = "done", 1.0
            except Exception as e:  # noqa
                job["status"], job["error"] = "error", "%s: %s" % (type(e).__name__, e)
                job["trace"] = traceback.format_exc()[-2000:]

        self._pool.submit(run)
        return jid

    def get(self, jid):
        return self._jobs.get(jid)
