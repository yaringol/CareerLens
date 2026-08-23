#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Reduce a folder of collected CVs to one document per person.

A corpus assembled by asking people for their CV accumulates two kinds of
duplicate, and they need different treatment:

  * The same bytes twice - a re-download, a "(1)" copy. Redundant, no
    information lost by dropping one.
  * The same person, different version - "CV 2024", "CV (2)", a rename. These
    are NOT identical files, and keeping them all silently weights that person
    several times in every rate the corpus produces. One person contributing
    eight documents to a 66-file corpus is 12% of it.

Selection rule when a person has several versions: keep the one with the most
extractable text. Not the largest file - a scan or an embedded-font PDF can be
several times bigger while yielding less text, and extractable text is exactly
what the pipeline under test consumes. Ties break toward the longer filename,
which in practice carries the version marker ("... 2024").

Nothing is deleted. Rejected copies move to _duplicates/ so any choice can be
reversed by moving a file back.

Filenames with no recoverable person name (".pdf", "resume.pdf") are NEVER
grouped together - an empty key is not evidence of a shared author. They are
deduplicated only when byte-identical.

Usage:
  python scripts/eval/26-dedupe-cv-corpus.py --dir "c:/Users/may20/Downloads/resume"
  python scripts/eval/26-dedupe-cv-corpus.py --dir <path> --apply   # actually move
"""
import argparse
import hashlib
import os
import re
import shutil
from collections import defaultdict

# Words that describe the document rather than the person.
NOISE = ("cv", "resume", "english", "programmer", "software", "developer",
         "engineer", "stver", "final", "new", "updated", "docx", "pdf")


def person_key(filename: str) -> str:
    """Compact letters-only author key, or '' when no name survives."""
    stem = os.path.splitext(filename)[0].lower()
    stem = re.sub(r"\(\d+\)", " ", stem)          # copy markers
    stem = re.sub(r"\d+", " ", stem)              # years, timestamps, versions
    stem = re.sub(r"[^a-z]+", " ", stem)
    tokens = [t for t in stem.split() if t not in NOISE]
    key = "".join(sorted(tokens))
    # "TalSomechCV" collapses with no space, so strip noise as a substring too.
    for w in ("cv", "resume"):
        while key.startswith(w):
            key = key[len(w):]
        while key.endswith(w):
            key = key[: -len(w)]
    return key if len(key) >= 4 else ""


def text_len(path: str) -> int:
    try:
        import fitz
        with fitz.open(path) as doc:
            return sum(len(p.get_text()) for p in doc)
    except Exception:
        return -1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--apply", action="store_true",
                    help="move rejected copies into _duplicates/ (default: report only)")
    args = ap.parse_args()

    files = sorted(f for f in os.listdir(args.dir) if f.lower().endswith(".pdf"))
    info = {}
    for f in files:
        p = os.path.join(args.dir, f)
        info[f] = {
            "sha1": hashlib.sha1(open(p, "rb").read()).hexdigest(),
            "bytes": os.path.getsize(p),
            "chars": text_len(p),
        }

    drop = {}   # filename -> reason

    # ---- pass 1: byte-identical copies
    by_hash = defaultdict(list)
    for f in files:
        by_hash[info[f]["sha1"]].append(f)
    print("== byte-identical copies ==")
    for h, group in by_hash.items():
        if len(group) < 2:
            continue
        keep = min(group, key=len)      # the name without the "(1)" marker
        print("  keep %s" % keep)
        for f in group:
            if f != keep:
                drop[f] = "identical to %s" % keep
                print("    drop %s" % f)
    if not any(len(g) > 1 for g in by_hash.values()):
        print("  none")

    # ---- pass 2: same person, different version
    by_person = defaultdict(list)
    for f in files:
        if f in drop:
            continue
        k = person_key(f)
        if k:
            by_person[k].append(f)
    print("\n== same person, several versions ==")
    found = False
    for k, group in sorted(by_person.items()):
        if len(group) < 2:
            continue
        found = True
        keep = max(group, key=lambda f: (info[f]["chars"], len(f)))
        print("  %s" % k)
        for f in sorted(group):
            mark = "KEEP" if f == keep else "drop"
            print("    %-4s %-46s %6d chars  %7d bytes"
                  % (mark, f[:46], info[f]["chars"], info[f]["bytes"]))
            if f != keep:
                drop[f] = "older/shorter version of %s" % keep
    if not found:
        print("  none")

    unnamed = [f for f in files if f not in drop and not person_key(f)]
    print("\n== no recoverable name (kept, never grouped) ==")
    for f in unnamed:
        print("   ", f)
    if not unnamed:
        print("  none")

    kept = len(files) - len(drop)
    print("\n%d files -> %d unique documents (%d moved aside)" % (len(files), kept, len(drop)))

    if not args.apply:
        print("\nreport only. re-run with --apply to move the %d copies into _duplicates/"
              % len(drop))
        return

    dest = os.path.join(args.dir, "_duplicates")
    os.makedirs(dest, exist_ok=True)
    with open(os.path.join(dest, "WHY.txt"), "w", encoding="utf-8") as fh:
        fh.write("Moved by scripts/eval/26-dedupe-cv-corpus.py.\n"
                 "Nothing was deleted; move a file back to restore it.\n\n")
        for f, why in sorted(drop.items()):
            fh.write("%s\n    %s\n" % (f, why))
    for f in drop:
        shutil.move(os.path.join(args.dir, f), os.path.join(dest, f))
    print("moved %d files to %s" % (len(drop), dest))


if __name__ == "__main__":
    main()
