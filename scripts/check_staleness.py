#!/usr/bin/env python3
"""Report outdated translations and workshops that need review.

- translation outdated: the source file's `last_updated` is newer than the date in `translated_from`
- needs review: last_updated older than 12 months
- archived: `archived: true` in frontmatter (never reported as stale)

Usage:
  python3 scripts/check_staleness.py            # print markdown report
  python3 scripts/check_staleness.py --github   # also update the tracking issue and open per-translation issues (needs gh)
"""
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate import ROOT, is_date, load_workshops  # noqa: E402

REVIEW_AFTER = timedelta(days=365)
TRACKING_TITLE = "Workshop staleness report"


def source(fm):
    """Parse `translated_from: <lang>@YYYY-MM-DD` into (lang, date); (None, None) if absent or malformed."""
    try:
        lang, day = str(fm.get("translated_from", "")).split("@", 1)
        return lang, date.fromisoformat(day)
    except ValueError:
        return None, None


def status(path, fm, langs=None, today=None):
    """One of: archived, outdated, review, current. `langs` maps lang → frontmatter for the same workshop."""
    today = today or date.today()
    langs = langs or {}
    if fm is None:
        return "review"
    if fm.get("archived") or any(f.get("archived") for f in langs.values() if f and not f.get("translated_from")):
        return "archived"
    if fm.get("translated_from"):
        src_lang, src_date = source(fm)
        src_updated = (langs.get(src_lang) or {}).get("last_updated")
        if src_date is None or not is_date(src_updated) or src_updated > src_date:
            return "outdated"
    updated = fm.get("last_updated")
    if not is_date(updated) or today - updated > REVIEW_AFTER:
        return "review"
    return "current"


def grouped(root=ROOT):
    """{slug: {lang: (path, frontmatter)}} for all parseable files."""
    out = {}
    for path, fm, _ in load_workshops(root):
        if fm is not None:
            out.setdefault(path.parent.parent.name, {})[path.parent.name] = (path, fm)
    return out


def statuses(root=ROOT):
    """[(slug, lang, status)] for every file."""
    rows = []
    for slug, langs in grouped(root).items():
        fms = {lang: fm for lang, (_, fm) in langs.items()}
        rows += [(slug, lang, status(path, fm, fms)) for lang, (path, fm) in sorted(langs.items())]
    return rows


def report(root=ROOT):
    rows = statuses(root)
    outdated = [(s, l) for s, l, st in rows if st == "outdated"]
    review = [(s, l) for s, l, st in rows if st == "review"]
    lines = [f"_Generated {date.today()} by `scripts/check_staleness.py`._", ""]
    lines += ["## Outdated translations", ""] + ([f"- `{s}` → `{l}`" for s, l in outdated] or ["- none"])
    lines += ["", "## Needs review (last_updated older than 12 months)", ""] + ([f"- `{s}` ({l})" for s, l in review] or ["- none"])
    return "\n".join(lines) + "\n", outdated


def gh(*args):
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout.strip()


def sync_github(body, outdated):
    """Upsert the tracking issue; open one issue per outdated translation if none is open yet."""
    open_titles = gh("issue", "list", "--state", "open", "--limit", "500", "--json", "title,number",
                     "--jq", ".[] | \"\\(.number)\\t\\(.title)\"").splitlines()
    by_title = {t.split("\t", 1)[1]: t.split("\t", 1)[0] for t in open_titles if "\t" in t}
    if TRACKING_TITLE in by_title:
        gh("issue", "edit", by_title[TRACKING_TITLE], "--body", body)
    else:
        gh("issue", "create", "--title", TRACKING_TITLE, "--body", body)
        print("Created tracking issue - pin it manually in the Issues tab.")
    for slug, lang in outdated:
        title = f"Translation outdated: {slug} → {lang}"
        if title in by_title:
            continue
        gh("issue", "create", "--title", title, "--label", "translation wanted", "--body",
           f"The source file has a newer `last_updated` than the date recorded in "
           f"`workshops/{slug}/{lang}/README.md` (`translated_from`).\n\n"
           f"Update the translation and set `translated_from` to the source file's `last_updated` "
           f"(see CONTRIBUTING.md).")


if __name__ == "__main__":
    body, outdated = report()
    print(body)
    if "--github" in sys.argv:
        sync_github(body, outdated)
