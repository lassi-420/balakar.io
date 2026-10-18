import io, json, os, sys, threading, time, urllib.request, urllib.error, zipfile, xml.dom.minidom
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "engine"))
from captionkit import exporters, segmenter, enhance, server, config


def words():
    t = 0.0
    out = []
    for w in "yeh ek test hai jo bahut lamba ho sakta hai. phir naya line shuru hota hai".split():
        out.append({"text": w, "start": t, "end": t + 0.3}); t += 0.35
    return out


def test_group_and_overlap():
    segs = segmenter.group_words(words(), max_chars=24, max_words=5)
    assert len(segs) >= 3
    for a, b in zip(segs, segs[1:]):
        assert a["end"] <= b["start"] + 1e-9
    assert all(len(s["text"]) <= 24 + 12 for s in segs)


def test_roundtrip_srt_vtt():
    segs = segmenter.group_words(words())
    for fmt in ("srt", "vtt"):
        data = exporters.export(fmt, segs).decode()
        back = exporters.parse_subtitles(data)
        assert len(back) == len(segs)
        assert abs(back[0]["end"] - segs[0]["end"]) < 0.002
        assert back[0]["text"] == segs[0]["text"]


def test_unicode_and_docx():
    segs = [{"start": 0, "end": 1.5, "text": "یہ ایک ٹیسٹ ہے", "words": []},
            {"start": 1.5, "end": 3, "text": "<tag> & more", "words": []}]
    data = exporters.to_docx_bytes(segs, lang="ur")
    z = zipfile.ZipFile(io.BytesIO(data))
    doc = z.read("word/document.xml").decode("utf-8")
    xml.dom.minidom.parseString(doc)  # well-formed
    assert "<w:bidi/>" in doc and "یہ ایک" in doc and "&lt;tag&gt;" in doc
    assert "ٹیسٹ" in exporters.to_md(segs) and exporters.to_txt(segs).strip()


def test_spread_words():
    w = segmenter.spread_words("hello big world", 0, 3)
    assert len(w) == 3 and abs(w[-1]["end"] - 3) < 0.01


def test_ffmpeg_chain():
    c = enhance.ffmpeg_chain("heavy")
    assert "afftdn=nr=28" in c and "loudnorm" in c and c.startswith("highpass")


def test_server_auth_and_export(tmp_path):
    cfg = config.load(); cfg["port"] = 0
    app = server.App(cfg)
    srv = server.ThreadingHTTPServer(("127.0.0.1", 0), server.make_handler(app, "tok"))
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % port
    h = json.load(urllib.request.urlopen(base + "/health"))
    assert h["ok"] and len(h["languages"]) == 20
    req = urllib.request.Request(base + "/export", data=b"{}", method="POST")
    try:
        urllib.request.urlopen(req); assert False
    except urllib.error.HTTPError as e:
        assert e.code == 401
    out = str(tmp_path / "x.srt")
    req = urllib.request.Request(base + "/export", method="POST", headers={"X-KK-Token": "tok"},
        data=json.dumps({"format": "srt", "path": out, "segments": [{"start": 0, "end": 1, "text": "hi"}]}).encode())
    assert json.load(urllib.request.urlopen(req))["bytes"] > 0 and os.path.isfile(out)
    srv.shutdown()
