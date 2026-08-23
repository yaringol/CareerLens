"""
Robust SkillNer annotation with a chunked fallback.

SkillNer's low-form matcher can raise IndexError/ValueError on certain real-world
texts (token/word index misalignment inside the library - hit by an authentic CV
during M18 evaluation). When whole-document annotation fails, annotating the
document in small line-aligned chunks and merging the results recovers the
skills (measured: 0 -> 37 skills on the failing CV) - the library bug is
triggered by specific long-range token layouts, not by the content itself.
"""
from __future__ import annotations

from typing import Any

CHUNK_TARGET_CHARS = 600


def identity(x):
    """Pass-through analyzer for CountVectorizer over pre-tokenized skill sets.

    Lives in a module (not a notebook cell) so artifacts pickled with it can be
    unpickled by any process that imports skillner_utils - notebooks that define
    their own `identity` produce joblib files only the notebook can reload.
    """
    return x


def _empty() -> dict[str, list]:
    return {"full_matches": [], "ngram_matches": []}


def _annotate_once(skill_extractor, text: str) -> dict[str, list]:
    annotations = skill_extractor.annotate(text)
    results = annotations.get("results", {})
    return {
        "full_matches": results.get("full_matches", []),
        "ngram_matches": results.get("ngram_scored", []),
    }


def _line_chunks(text: str, target: int = CHUNK_TARGET_CHARS) -> list[str]:
    chunks: list[str] = []
    current = ""
    for line in text.splitlines():
        current += line + "\n"
        if len(current) >= target:
            chunks.append(current)
            current = ""
    if current.strip():
        chunks.append(current)
    return chunks


def annotate_with_fallback(skill_extractor, text: str) -> dict[str, list]:
    """Whole-document annotation; on a SkillNer internal failure, fall back to
    per-chunk annotation and merge (deduplicated by matched skill text, keeping
    the highest-scored ngram match). Returns {} matches only if every chunk fails."""
    try:
        return _annotate_once(skill_extractor, text)
    except Exception:
        pass

    merged = _empty()
    seen_full: set[str] = set()
    best_ngram: dict[str, dict[str, Any]] = {}
    any_chunk_ok = False
    for chunk in _line_chunks(text):
        try:
            result = _annotate_once(skill_extractor, chunk)
        except Exception:
            continue
        any_chunk_ok = True
        for m in result["full_matches"]:
            key = (m.get("doc_node_value") or "").lower()
            if key and key not in seen_full:
                seen_full.add(key)
                merged["full_matches"].append(m)
        for m in result["ngram_matches"]:
            key = (m.get("doc_node_value") or "").lower()
            if not key:
                continue
            prev = best_ngram.get(key)
            if prev is None or float(m.get("score", 0)) > float(prev.get("score", 0)):
                best_ngram[key] = m

    merged["ngram_matches"] = list(best_ngram.values())
    if not any_chunk_ok:
        print("  SkillNer failed on the whole document AND on every chunk: no skills")
    return merged
