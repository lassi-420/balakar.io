"""Local audio enhancement: ffmpeg denoise chain, optional DeepFilterNet / noisereduce engines."""
import os
import shutil
import subprocess
import tempfile
import wave

from . import audio as audiomod

PRESETS = {  # afftdn noise reduction (dB), noise floor (dB)
    "light": (10, -30),
    "standard": (18, -32),
    "heavy": (28, -36),
}


def ffmpeg_chain(preset="standard", loudnorm=True, rnnoise_model=None):
    nr, nf = PRESETS.get(preset, PRESETS["standard"])
    f = ["highpass=f=80"]
    if rnnoise_model and os.path.isfile(rnnoise_model):
        f.append("arnndn=m=%s" % rnnoise_model.replace("\\", "/").replace(":", "\\:"))
    f.append("afftdn=nr=%d:nf=%d:tn=1" % (nr, nf))
    f.append("acompressor=threshold=-20dB:ratio=3:attack=5:release=80")
    if loudnorm:
        f.append("loudnorm=I=-16:TP=-1.5:LRA=11")
    return ",".join(f)


def enhance(src, dst=None, engine="ffmpeg", preset="standard", ffmpeg="ffmpeg",
            rnnoise_model=None, loudnorm=True):
    ff = audiomod.find_ffmpeg(ffmpeg)
    if not os.path.isfile(src):
        raise FileNotFoundError(src)
    base = os.path.splitext(src)[0]
    dst = dst or base + "_enhanced.wav"
    work = src
    tmp = None
    try:
        if engine == "deepfilternet":
            exe = shutil.which("deepFilter") or shutil.which("deep-filter")
            if not exe:
                raise RuntimeError("DeepFilterNet CLI not found (pip install deepfilternet).")
            tmp = tempfile.mkdtemp(prefix="kk_dfn_")
            wav = os.path.join(tmp, "in.wav")
            subprocess.run([ff, "-y", "-nostdin", "-v", "error", "-i", src, "-vn", "-ar", "48000",
                            "-ac", "1", wav], check=True)
            subprocess.run([exe, wav, "-o", tmp], check=True)
            work = os.path.join(tmp, "in_DeepFilterNet3.wav")
            if not os.path.isfile(work):
                cands = [x for x in os.listdir(tmp) if x != "in.wav" and x.endswith(".wav")]
                work = os.path.join(tmp, cands[0])
            chain = "loudnorm=I=-16:TP=-1.5:LRA=11" if loudnorm else "anull"
        elif engine == "noisereduce":
            import numpy as np
            import noisereduce as nr
            y = audiomod.decode_f32(src, ffmpeg, sr=48000)
            y = nr.reduce_noise(y=y, sr=48000, stationary=False, prop_decrease=0.9)
            tmp = tempfile.mkdtemp(prefix="kk_nr_")
            work = os.path.join(tmp, "nr.wav")
            with wave.open(work, "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(48000)
                w.writeframes((np.clip(y, -1, 1) * 32767).astype("<i2").tobytes())
            chain = "loudnorm=I=-16:TP=-1.5:LRA=11" if loudnorm else "anull"
        else:
            chain = ffmpeg_chain(preset, loudnorm, rnnoise_model)
        cmd = [ff, "-y", "-nostdin", "-v", "error", "-i", work, "-vn", "-af", chain,
               "-ar", "48000", "-c:a", "pcm_s16le", dst]
        subprocess.run(cmd, check=True, stderr=subprocess.PIPE,
                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    except subprocess.CalledProcessError as e:
        raise RuntimeError((e.stderr or b"").decode("utf-8", "replace")[-1500:] or str(e))
    finally:
        if tmp:
            shutil.rmtree(tmp, ignore_errors=True)
    return {"output": dst, "engine": engine, "preset": preset}
