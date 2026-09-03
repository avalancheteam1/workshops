#!/usr/bin/env python3
"""Validate every workshops/<slug>/<lang>/ (meta.yml + README.md) against the workshop format.

Usage: python3 scripts/validate.py [ROOT]
Exit code 1 if any error was found. Errors are printed as `path: message`.
"""
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
LEVEL_ORDER = {"beginner": 0, "intermediate": 1, "advanced": 2}
LEVELS = set(LEVEL_ORDER)
REQUIRED = ["title", "language", "authors", "level", "duration", "last_updated"]
# ponytail: BCP-47 subset — language, optional script, optional region (en, pt-BR, zh-Hans, zh-Hant-TW)
LANG_RE = re.compile(r"^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2}|-[0-9]{3})?$")
SLUG_RE = re.compile(r"^[a-z]+(-[a-z]+)*$")
SOURCE_RE = re.compile(r"^([A-Za-z0-9-]+)@(\d{4}-\d{2}-\d{2})$")
REQUIRED_HEADINGS = ["## Overview", "## Prerequisites", "## Workshop", "## Resources"]
OPTIONAL_HEADINGS = ["## Learning objectives", "## Exercises", "## Next steps"]
HEADINGS = REQUIRED_HEADINGS + OPTIONAL_HEADINGS
LINK_RE = re.compile(r"!?\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")


def is_date(x):
    """A plain YAML date, not a timestamp (datetime subclasses date)."""
    return isinstance(x, date) and not isinstance(x, datetime)


def load_meta(path):
    """Parse a meta.yml; raise ValueError if it is not a mapping."""
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("not a mapping")
    return data


def load_workshops(root=ROOT):
    """Yield (README path, meta dict, README text) for every workshops/<slug>/<lang>/.

    A folder counts if it has meta.yml or README.md. A missing or unparseable meta.yml yields meta=None with the error as text.
    """
    dirs = {p.parent for p in (root / "workshops").glob("*/*/meta.yml")} | {p.parent for p in (root / "workshops").glob("*/*/README.md")}
    for d in sorted(dirs):
        readme, meta = d / "README.md", d / "meta.yml"
        if not meta.exists():
            yield readme, None, "missing meta.yml"
            continue
        try:
            fm = load_meta(meta)
        except (ValueError, yaml.YAMLError) as e:
            yield readme, None, f"meta.yml: {e}"
            continue
        yield readme, fm, readme.read_text(encoding="utf-8") if readme.exists() else ""


def check_file(path, fm, body, slugs, root):
    """Return (errors, warnings). Errors fail validation; warnings are advisory."""
    slug, lang = path.parent.parent.name, path.parent.name
    errors, warnings = [], []
    if fm is None:
        return [body], []  # body holds the load error
    if not path.exists():
        errors.append("missing README.md")
    if not SLUG_RE.match(slug):
        errors.append(f"slug '{slug}' must be lowercase words joined by hyphens, no digits")
    if not LANG_RE.match(lang):
        errors.append(f"language folder '{lang}' is not a BCP-47 tag like en, pt-BR, zh-Hans")

    for key in REQUIRED:
        if key not in fm or fm[key] in (None, "", []):
            errors.append(f"meta.yml: '{key}' is required")
    if fm.get("language") != lang:
        errors.append(f"meta.yml: language '{fm.get('language')}' must equal folder name '{lang}'")
    if fm.get("level") not in LEVELS:
        errors.append(f"meta.yml: level must be one of {sorted(LEVELS)}")
    if "last_updated" in fm and not is_date(fm["last_updated"]):
        errors.append("meta.yml: last_updated must be a plain date (YYYY-MM-DD), no time")
    if "archived" in fm and not isinstance(fm["archived"], bool):
        errors.append("meta.yml: archived must be true or false (unquoted)")
    if "order" in fm and not (isinstance(fm["order"], int) and not isinstance(fm["order"], bool)):
        errors.append("meta.yml: order must be an integer")
    for key in ("authors", "translators", "maintainers", "prerequisites"):
        if key in fm and not isinstance(fm[key], list):
            errors.append(f"meta.yml: '{key}' must be a list")
    for key in ("authors", "translators", "maintainers"):
        for person in fm.get(key) if isinstance(fm.get(key), list) else []:
            if isinstance(person, dict):
                if not isinstance(person.get("name"), str):
                    errors.append(f"meta.yml: entries in '{key}' need a 'name'")
                if "url" in person and not str(person["url"]).startswith("http"):
                    errors.append(f"meta.yml: '{key}' url must start with http")
            elif not isinstance(person, str):
                errors.append(f"meta.yml: entries in '{key}' must be a name or {{name, url}}")

    source = fm.get("translated_from")
    siblings = {p.name for p in path.parent.parent.iterdir() if (p / "meta.yml").exists()}
    if source and not (isinstance(fm.get("translators"), list) and fm["translators"]):
        errors.append("meta.yml: translations need at least one entry in 'translators'")
    if source:
        m = SOURCE_RE.match(str(source))
        if not m:
            errors.append(f"meta.yml: translated_from '{source}' must look like en@2026-09-03 (source language @ its last_updated)")
        elif m.group(1) == lang or m.group(1) not in siblings:
            errors.append(f"meta.yml: translated_from points to '{m.group(1)}', which is not another language of this workshop")
        else:
            try:
                src_date = date.fromisoformat(m.group(2))
            except ValueError:
                errors.append(f"meta.yml: translated_from date '{m.group(2)}' is not a real date")
            else:
                try:
                    src_updated = load_meta(path.parent.parent / m.group(1) / "meta.yml").get("last_updated")
                except (ValueError, yaml.YAMLError):
                    src_updated = None
                if src_date > date.today():
                    errors.append("meta.yml: translated_from date is in the future")
                elif is_date(src_updated) and src_date > src_updated:
                    errors.append(f"meta.yml: translated_from date is later than {m.group(1)}'s last_updated ({src_updated})")

    for pre in fm.get("prerequisites") if isinstance(fm.get("prerequisites"), list) else []:
        if pre not in slugs:
            errors.append(f"meta.yml: prerequisite '{pre}' is not a workshop slug")

    lines = body.splitlines()
    h1 = [l for l in lines if l.startswith("# ")]
    if not h1:
        errors.append("README.md: missing '# <Title>' heading")
    elif isinstance(fm.get("title"), str) and h1[0][2:].strip() != fm["title"].strip():
        errors.append(f"README.md: heading '{h1[0][2:].strip()}' must equal meta.yml title '{fm['title']}'")
    h2 = [l.strip() for l in lines if l.startswith("## ")]
    if lang == "en":
        # required headings must appear as an ordered subsequence; extra ## sections are fine
        it = iter(h2)
        missing = [h for h in REQUIRED_HEADINGS if not any(x == h for x in it)]
        if missing:
            errors.append(f"README.md: required headings missing or out of order: {', '.join(missing)}")
        for h in OPTIONAL_HEADINGS:
            if h not in h2:
                warnings.append(f"README.md: optional section '{h}' is missing")
    else:
        # ponytail: non-English headings can't be matched by text; go by section count
        if len(h2) < len(REQUIRED_HEADINGS):
            errors.append(f"README.md: expected at least {len(REQUIRED_HEADINGS)} '## ' sections (overview, prerequisites, workshop, resources), found {len(h2)}")
        elif len(h2) < len(HEADINGS):
            warnings.append(f"README.md: {len(h2)} '## ' sections; the template has {len(HEADINGS)} (learning objectives, exercises, next steps are optional)")

    for target in LINK_RE.findall(body):
        if re.match(r"^[a-z][a-z0-9+.-]*:", target) or target.startswith("#"):
            continue  # absolute URL, mailto:, or in-page anchor
        rel = target.split("#", 1)[0]
        if rel and not (path.parent / rel).exists():
            errors.append(f"README.md: link '{target}' does not resolve")
    return errors, warnings


def validate(root=ROOT, warnings=None):
    """Return list of (path, error) tuples. Warnings are appended to the `warnings` list if given."""
    if not (root / "workshops").is_dir():
        return [(root / "workshops", "directory not found")]
    items = list(load_workshops(root))
    slugs = {p.parent.parent.name for p, _, _ in items}
    problems = []
    for p, fm, body in items:
        errs, warns = check_file(p, fm, body, slugs, root)
        problems += [(p, e) for e in errs]
        if warnings is not None:
            warnings += [(p, w) for w in warns]
    for slug in sorted(slugs):
        files = [(p, fm) for p, fm, _ in items if p.parent.parent.name == slug and fm is not None]
        originals = [p for p, fm in files if not fm.get("translated_from")]
        if files and not originals:
            problems.append((files[0][0], "every workshop needs one original without translated_from in meta.yml"))
        for p in originals[1:]:
            problems.append((p, f"only one original per workshop; translations need translated_from (original is {originals[0].parent.name}/)"))
    return problems


if __name__ == "__main__":
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT
    warnings = []
    problems = validate(root, warnings)
    ci = os.environ.get("GITHUB_ACTIONS")
    for p, w in warnings:
        print(f"::warning file={p.relative_to(root)}::{w}" if ci else f"{p.relative_to(root)}: warning: {w}")
    for p, e in problems:
        print(f"::error file={p.relative_to(root)}::{e}" if ci else f"{p.relative_to(root)}: {e}")
    n = len(list(load_workshops(root))) if (root / "workshops").is_dir() else 0
    print(f"{len(problems)} error(s), {len(warnings)} warning(s) in {n} workshop folder(s)")
    sys.exit(1 if problems else 0)
