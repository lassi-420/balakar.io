"""Install a custom font for the current user (After Effects needs a restart to see it)."""
import os
import shutil
import subprocess
import sys


def _ps_name(path):
    try:
        from fontTools.ttLib import TTFont
        f = TTFont(path, fontNumber=0)
        name = f["name"]
        return (name.getDebugName(6) or None), (name.getDebugName(1) or None)
    except Exception:
        return None, None


def install_font(path):
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    ext = os.path.splitext(path)[1].lower()
    if ext not in (".ttf", ".otf", ".ttc"):
        raise ValueError("Only .ttf/.otf/.ttc fonts are supported")
    ps, family = _ps_name(path)
    fname = os.path.basename(path)
    if sys.platform.startswith("win"):
        import ctypes
        import winreg
        d = os.path.join(os.environ["LOCALAPPDATA"], "Microsoft", "Windows", "Fonts")
        os.makedirs(d, exist_ok=True)
        dst = os.path.join(d, fname)
        shutil.copyfile(path, dst)
        kind = "OpenType" if ext == ".otf" else "TrueType"
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                            r"Software\Microsoft\Windows NT\CurrentVersion\Fonts", 0,
                            winreg.KEY_SET_VALUE) as k:
            winreg.SetValueEx(k, "%s (%s)" % (family or os.path.splitext(fname)[0], kind), 0,
                              winreg.REG_SZ, dst)
        ctypes.windll.gdi32.AddFontResourceW(dst)
    elif sys.platform == "darwin":
        d = os.path.expanduser("~/Library/Fonts")
        os.makedirs(d, exist_ok=True)
        dst = os.path.join(d, fname)
        shutil.copyfile(path, dst)
    else:
        d = os.path.expanduser("~/.local/share/fonts")
        os.makedirs(d, exist_ok=True)
        dst = os.path.join(d, fname)
        shutil.copyfile(path, dst)
        subprocess.run(["fc-cache", "-f"], check=False)
    return {"installed": dst, "postscriptName": ps, "family": family, "restartRequired": True}
