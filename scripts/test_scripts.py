#!/usr/bin/env python3
"""Smallest check that fails if validate/staleness/index logic breaks. Run: python3 scripts/test_scripts.py"""
import datetime
import shutil
import tempfile
from datetime import date
from pathlib import Path

import build_index
from check_staleness import status
from validate import validate

META = """title: Good
language: {lang}
authors: [A]
level: beginner
duration: 1 hour
last_updated: {updated}
prerequisites: {prereqs}
{extra}"""

BODY = """# Good

## Overview
## Learning objectives
## Prerequisites
## Workshop
## Exercises
## Next steps
## Resources
[img](../assets/x.png)
"""


def write(root, slug, lang, body=BODY, **kw):
    d = root / "workshops" / slug / lang
    d.mkdir(parents=True, exist_ok=True)
    kw.setdefault("lang", lang)
    kw.setdefault("updated", date.today())
    kw.setdefault("prereqs", "[]")
    kw.setdefault("extra", "")
    (d / "meta.yml").write_text(META.format(**kw))
    (d / "README.md").write_text(body)
    return d


def asset(root, slug):
    (root / "workshops" / slug / "assets").mkdir(parents=True, exist_ok=True)
    (root / "workshops" / slug / "assets" / "x.png").touch()


root = Path(tempfile.mkdtemp())
try:
    asset(root, "good")
    write(root, "good", "en")
    write(root, "good", "pt-BR", extra="translated_from: en@2026-01-01\ntranslators: [T]\n")
    assert validate(root) == [], validate(root)

    # optional sections only warn; required ones error
    d = root / "workshops" / "good" / "en"
    write(root, "good", "en", body=BODY.replace("## Exercises\n", ""))
    warns = []
    assert validate(root, warns) == [], validate(root)
    assert any("optional section '## Exercises'" in w for _, w in warns), warns
    write(root, "good", "en", body=BODY.replace("## Workshop\n", ""))
    assert any("required headings" in e for _, e in validate(root)), validate(root)
    write(root, "good", "en")

    # scalar lists, timestamps, quoted archived, bad/future translated_from, title mismatch, two originals, missing files
    asset(root, "scalar")
    write(root, "scalar", "en", extra="maintainers: 5\narchived: \"false\"\n")
    errs = [e for _, e in validate(root)]
    assert any("'maintainers' must be a list" in e for e in errs), errs
    assert any("archived must be true or false" in e for e in errs), errs
    write(root, "scalar", "en", updated="2026-01-01 10:00:00", body=BODY.replace("# Good", "# Other"))
    errs = [e for _, e in validate(root)]
    assert any("plain date" in e for e in errs), errs
    assert any("must equal meta.yml title" in e for e in errs), errs
    write(root, "scalar", "en", updated="2026-01-01")
    write(root, "scalar", "fr", extra="translated_from: en@2026-02-30\ntranslators: [T]\n")
    assert any("not a real date" in e for _, e in validate(root)), validate(root)
    write(root, "scalar", "es", extra="translated_from: en@2999-01-01\ntranslators: [T]\n")
    assert any("in the future" in e for _, e in validate(root)), validate(root)
    write(root, "scalar", "it", extra="translated_from: en@2026-01-02\ntranslators: [T]\n")
    assert any("later than en's last_updated" in e for _, e in validate(root)), validate(root)
    write(root, "scalar", "nl", extra="translated_from: en@2026-01-01\n")
    assert any("'translators'" in e for _, e in validate(root)), validate(root)
    write(root, "scalar", "pt")  # second original
    assert any("only one original" in e for _, e in validate(root)), validate(root)
    (root / "workshops" / "scalar" / "pt" / "meta.yml").unlink()
    assert any("missing meta.yml" in e for _, e in validate(root)), validate(root)
    (root / "workshops" / "scalar" / "it" / "README.md").unlink()
    assert any("missing README.md" in e for _, e in validate(root)), validate(root)
    assert validate(root / "nope") and "not found" in validate(root / "nope")[0][1]
    shutil.rmtree(root / "workshops" / "scalar")

    # the template itself must validate without errors or warnings
    tpl = Path(__file__).resolve().parent.parent / "templates" / "workshop"
    d = root / "workshops" / "example" / "en"
    shutil.copytree(tpl, d)
    warns = []
    assert validate(root, warns) == [] and warns == [], (validate(root), warns)
    shutil.rmtree(root / "workshops" / "example")

    # a non-English original is fine; a workshop with only translations is not; bad prereq, slug, link
    asset(root, "zhonly")
    write(root, "zhonly", "zh-Hans")
    assert validate(root) == [], validate(root)
    write(root, "orphan", "de", extra="translated_from: fr@2026-01-01\ntranslators: [T]\n")
    write(root, "bad2", "en", prereqs="[nope]")
    errs = [e for _, e in validate(root)]
    assert any("needs one original" in e for e in errs), errs
    assert any("points to 'fr'" in e for e in errs), errs
    assert any("prerequisite 'nope'" in e for e in errs), errs
    assert any("slug 'bad2'" in e for e in errs), errs
    assert any("does not resolve" in e for e in errs), errs
    write(root, "badauthor", "en", extra="maintainers: [{url: https://x.y}]\n")
    assert any("need a 'name'" in e for _, e in validate(root)), validate(root)

    # staleness: source newer than translated_from → outdated; equal → current; old → review; archived wins
    p = root / "workshops" / "good" / "pt-BR" / "README.md"
    langs = {"en": {"last_updated": date(2026, 2, 1)}}
    assert status(p, {"translated_from": "en@2026-01-01", "last_updated": date.today()}, langs) == "outdated"
    assert status(p, {"translated_from": "en@2026-02-01", "last_updated": date.today()}, langs) == "current"
    p = root / "workshops" / "good" / "en" / "README.md"
    assert status(p, {"last_updated": datetime.datetime(2026, 1, 1, 10)}) == "review"  # timestamp never crashes
    assert status(p, {"last_updated": date(2020, 1, 1)}) == "review"
    assert status(p, {"last_updated": date.today()}) == "current"
    assert status(p, {"archived": True, "last_updated": date(2020, 1, 1)}) == "archived"

    # index: order 0 sorts before order 1 and before no order
    shutil.rmtree(root / "workshops")
    for slug, extra in (("zeta", "order: 0\n"), ("alpha", "order: 1\n"), ("mid", "")):
        asset(root, slug)
        write(root, slug, "en", extra=extra)
    order = [l.split("workshops/")[1].split("/")[0] for l in build_index.build(root).splitlines() if l.startswith("| [")]
    assert order == ["zeta", "alpha", "mid"], order
    print("ok")
finally:
    shutil.rmtree(root)
