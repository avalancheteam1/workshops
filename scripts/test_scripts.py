#!/usr/bin/env python3
"""Smallest check that fails if validate/staleness logic breaks. Run: python3 scripts/test_scripts.py"""
import datetime
import shutil
import tempfile
from datetime import date
from pathlib import Path

from check_staleness import status
from validate import validate
import build_index

GOOD = """---
title: Good
language: {lang}
authors: [A]
level: beginner
duration: 1 hour
last_updated: {updated}
prerequisites: {prereqs}
{extra}---

# Good

## Overview
## Learning objectives
## Prerequisites
## Workshop
## Exercises
## Next steps
## Resources
[img](../assets/x.png)
"""


def write(root, slug, lang, **kw):
    p = root / "workshops" / slug / lang / "README.md"
    p.parent.mkdir(parents=True)
    kw.setdefault("lang", lang)
    kw.setdefault("updated", date.today())
    kw.setdefault("prereqs", "[]")
    kw.setdefault("extra", "")
    p.write_text(GOOD.format(**kw))
    return p


root = Path(tempfile.mkdtemp())
try:
    (root / "workshops" / "good" / "assets").mkdir(parents=True)
    (root / "workshops" / "good" / "assets" / "x.png").touch()
    write(root, "good", "en")
    write(root, "good", "pt-BR", extra="translated_from: en@2026-01-01\ntranslators: [T]\n")
    assert validate(root) == [], validate(root)

    # optional sections only warn; required ones error
    p = root / "workshops" / "good" / "en" / "README.md"
    p.write_text(p.read_text().replace("## Exercises\n", ""))
    warns = []
    assert validate(root, warns) == [], validate(root)
    assert any("optional section '## Exercises'" in w for _, w in warns), warns
    p.write_text(p.read_text().replace("## Workshop\n", ""))
    assert any("required headings" in e for _, e in validate(root)), validate(root)
    p.write_text(p.read_text().replace("## Prerequisites\n", "## Prerequisites\n## Workshop\n").replace("## Resources\n", "## Exercises\n## Resources\n"))
    assert validate(root) == [], validate(root)

    # scalar lists, timestamps, quoted archived, bad/future translated_from, title mismatch, two originals
    write(root, "scalar", "en", extra="maintainers: 5\narchived: \"false\"\n")
    errs = [e for _, e in validate(root)]
    assert any("'maintainers' must be a list" in e for e in errs), errs
    assert any("archived must be true or false" in e for e in errs), errs
    (root / "workshops" / "scalar" / "en" / "README.md").write_text(
        GOOD.format(lang="en", updated="2026-01-01 10:00:00", prereqs="[]", extra="").replace("# Good", "# Other"))
    errs = [e for _, e in validate(root)]
    assert any("plain date" in e for e in errs), errs
    assert any("must equal frontmatter title" in e for e in errs), errs
    write(root, "scalar", "fr", extra="translated_from: en@2026-02-30\n")
    assert any("not a real date" in e for _, e in validate(root)), validate(root)
    write(root, "scalar", "es", extra="translated_from: en@2999-01-01\n")
    assert any("in the future" in e for _, e in validate(root)), validate(root)
    (root / "workshops" / "scalar" / "en" / "README.md").write_text(GOOD.format(lang="en", updated="2026-01-01", prereqs="[]", extra=""))
    write(root, "scalar", "it", extra="translated_from: en@2026-01-02\n")  # en last_updated is 2026-01-01
    assert any("later than en's last_updated" in e for _, e in validate(root)), validate(root)
    write(root, "scalar", "pt")  # second original
    assert any("only one original" in e for _, e in validate(root)), validate(root)
    assert validate(root / "nope") and "not found" in validate(root / "nope")[0][1]
    shutil.rmtree(root / "workshops" / "scalar")

    # the template itself must validate without errors or warnings
    d = root / "workshops" / "example" / "en"; d.mkdir(parents=True)
    shutil.copy(Path(__file__).resolve().parent.parent / "templates" / "workshop" / "README.md", d / "README.md")
    warns = []
    assert validate(root, warns) == [] and warns == [], (validate(root), warns)
    shutil.rmtree(root / "workshops" / "example")
    write(root, "trans", "en")
    write(root, "trans", "fr", extra="translated_from: en@2026-01-01\n")
    assert any("'translators'" in e for _, e in validate(root)), validate(root)
    shutil.rmtree(root / "workshops" / "trans")

    # a non-English original is fine; a workshop with only translations is not
    (root / "workshops" / "zhonly" / "assets").mkdir(parents=True)
    (root / "workshops" / "zhonly" / "assets" / "x.png").touch()
    write(root, "zhonly", "zh-Hans")
    assert validate(root) == [], validate(root)
    write(root, "orphan", "de", extra="translated_from: fr@2026-01-01\ntranslators: [T]\n")
    write(root, "bad2", "en", prereqs="[nope]", extra="translated_from: en@2026-01-01\n")
    errs = [e for _, e in validate(root)]
    assert any("needs one original file" in e for e in errs), errs
    assert any("points to 'fr'" in e for e in errs), errs
    assert any("points to 'en'" in e for e in errs), errs
    assert any("prerequisite 'nope'" in e for e in errs), errs
    assert any("slug 'bad2'" in e for e in errs), errs
    assert any("does not resolve" in e for e in errs), errs
    write(root, "badauthor", "en", extra="maintainers: [{url: https://x.y}]\n")
    assert any("need a 'name'" in e for _, e in validate(root)), validate(root)

    # staleness: en newer than translated_from → outdated; equal → current; old last_updated → review; archived wins
    p = root / "workshops" / "good" / "pt-BR" / "README.md"
    langs = {"en": {"last_updated": date(2026, 2, 1)}}
    assert status(p, {"translated_from": "en@2026-01-01", "last_updated": date.today()}, langs) == "outdated"
    assert status(p, {"translated_from": "en@2026-02-01", "last_updated": date.today()}, langs) == "current"
    p = root / "workshops" / "good" / "en" / "README.md"
    assert status(p, {"last_updated": datetime.datetime(2026, 1, 1, 10)}) == "review"  # timestamp never crashes
    assert status(p, {"last_updated": date(2020, 1, 1)}) == "review"
    assert status(p, {"last_updated": date.today()}) == "current"
    assert status(p, {"archived": True, "last_updated": date(2020, 1, 1)}) == "archived"
    # order: 0 sorts before order: 1 and before no order
    shutil.rmtree(root / "workshops")
    for slug, extra in (("zeta", "order: 0\n"), ("alpha", "order: 1\n"), ("mid", "")):
        (root / "workshops" / slug / "assets").mkdir(parents=True); (root / "workshops" / slug / "assets" / "x.png").touch()
        write(root, slug, "en", extra=extra)
    order = [l.split("workshops/")[1].split("/")[0] for l in build_index.build(root).splitlines() if l.startswith("| [")]
    assert order == ["zeta", "alpha", "mid"], order
    print("ok")
finally:
    shutil.rmtree(root)
