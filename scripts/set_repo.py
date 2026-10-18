#!/usr/bin/env python3
"""Point the project at your GitHub repo:  python scripts/set_repo.py yourname/balakar.io"""
import os, re, sys
OLD = "myprofile/balakar.io"
OLD_PAGES = "myprofile.github.io/balakar.io"
if len(sys.argv) != 2 or not re.fullmatch(r"[\w.-]+/[\w.-]+", sys.argv[1]):
    sys.exit("usage: python scripts/set_repo.py <github-user>/<repo>")
new, root, n = sys.argv[1], os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 0
for d, dirs, files in os.walk(root):
    dirs[:] = [x for x in dirs if x not in (".git", "dist", "node_modules", "__pycache__")]
    for f in files:
        if not f.endswith((".html", ".md", ".yml", ".nsi", ".ps1", ".py", ".json", ".txt")):
            continue
        p = os.path.join(d, f)
        try:
            s = open(p, encoding="utf-8").read()
        except UnicodeDecodeError:
            continue
        if (OLD in s or OLD_PAGES in s) and os.path.abspath(p) != os.path.abspath(__file__):
            user, repo = new.split("/")
            out = s.replace(OLD_PAGES, "%s.github.io/%s" % (user, repo)).replace(OLD, new)
            open(p, "w", encoding="utf-8", newline="").write(out); n += 1
print("updated %d files -> %s" % (n, new))
