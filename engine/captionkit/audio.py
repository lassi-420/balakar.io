"""ffmpeg helpers: decode any audio/video file to 16 kHz mono float32 for Whisper."""
import os
import shutil
import subprocess


class FFmpegError(RuntimeError):
    pass


def find_ffmpeg(cfg_value="ffmpeg"):
    path = os.environ.get("FFMPEG_PATH") or cfg_value
    found = shutil.which(path) or (path if os.path.isfile(path) else None)
    if not found:
        raise FFmpegError("ffmpeg not found. Install it or set KK_FFMPEG / config.json 'ffmpeg'.")
    return found


def _run(cmd):
    try:
        return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True,
                              creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    except subprocess.CalledProcessError as e:
        raise FFmpegError(e.stderr.decode("utf-8", "replace")[-1500:])


def decode_f32(path, ffmpeg="ffmpeg", sr=16000):
    """Return a float32 numpy array (mono, `sr` Hz). Works for audio-only files too."""
    import numpy as np
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    cmd = [find_ffmpeg(ffmpeg), "-nostdin", "-v", "error", "-i", path, "-vn", "-ac", "1",
           "-ar", str(sr), "-f", "f32le", "-"]
    out = _run(cmd).stdout
    return np.frombuffer(out, dtype=np.float32).copy()


def duration_seconds(path, ffmpeg="ffmpeg"):
    ff = find_ffmpeg(ffmpeg)
    probe = shutil.which("ffprobe", path=os.path.dirname(ff)) or shutil.which("ffprobe")
    if not probe:
        return None
    r = _run([probe, "-v", "error", "-show_entries", "format=duration", "-of",
              "default=nw=1:nk=1", path])
    try:
        return float(r.stdout.decode().strip())
    except ValueError:
        return None
