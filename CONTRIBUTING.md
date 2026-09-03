# Contributing

Copy an existing workshop, change it, open a pull request. No approval needed up front.

## The one workflow

1. Fork and clone this repository.
2. Copy `templates/workshop/README.md` (or an existing workshop's README) to `workshops/<slug>/<lang>/README.md`. Shared images and code go in `workshops/<slug>/assets/`, beside the language folders, not inside them.
3. Fill in the frontmatter and write the sections. Overview, Prerequisites, Workshop, and Resources are required, in that order. Learning objectives, Exercises, and Next steps are optional; the validator only warns when they are missing.
4. Run `python3 scripts/validate.py` (needs `pip install pyyaml`). CI runs the same check.
5. Open a pull request and tick the checklist in the template.

Do not edit `README.md`. It is generated from the frontmatter after each merge.

## Three kinds of contribution

### New workshop

```
workshops/getting-started/en/README.md     ← the canonical English version
workshops/getting-started/assets/          ← images and code shared by all languages (optional)
```

- Slug: lowercase words joined by hyphens, no digits (`build-your-first-dapp`).
- Write the original in whatever language you write best. `en/` is preferred because most people can translate from it, but a workshop may start in any language.
- Order and learning paths come from `prerequisites`, `track`, and the optional `order` field, not from numbering folders.
- Slides, repos, and recordings stay outside this repo. Link them under `links:` and in Resources. Do not pin them to a commit.

### Translation

```
workshops/getting-started/de/README.md
```

- Folder name is a BCP-47 tag: `de`, `pt-BR`, `zh-Hans`. The first folder for a language creates it.
- Set `language` to the folder name, add yourself under `translators`, keep `authors` from the source.
- Set `translated_from` to the language and `last_updated` date of the file you translated, so we can detect when the source moves on. If `en/README.md` says `last_updated: 2026-09-03`, write `translated_from: en@2026-09-03`. Translating from `zh-Hans/` gives `zh-Hans@<date>`.
- Translate the headings too. Keep the same number of `##` sections in the same order.
- Images and code in `assets/` are shared. Reference them with `../assets/<file>`.

### Improvement

```
workshops/getting-started/en/README.md   (edit in place)
```

- Bump `last_updated` when content changes. If you verified against new tool versions, update `tested_with`.
- Bumping `last_updated` in the original makes its translations show as outdated in the index. That is expected. Open a "translation wanted" issue or ping the translators if the change is substantial.

## Frontmatter reference

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Also the `# ` heading of the file |
| `language` | yes | Must equal the folder name |
| `authors` | yes | List of people, see below |
| `translators` | translations | List of people, see below |
| `maintainers` | no | Who to ask about this workshop |
| `level` | yes | `beginner`, `intermediate`, `advanced` |
| `duration` | yes | Free text, e.g. `90 minutes` |
| `prerequisites` | no | List of workshop slugs that must exist |
| `track` | no | Learning-path name |
| `order` | no | Integer. Index is sorted by level, then `order`, then slug |
| `last_updated` | yes | `YYYY-MM-DD` |
| `tested_with` | no | Map of tool → version |
| `translated_from` | translations | `<source lang>@` + the source file's `last_updated` date |
| `links` | no | Any key → URL, e.g. `slides`, `code`, `video`, `blog` |
| `archived` | no | `true` moves the workshop to the archived table |

People (`authors`, `translators`, `maintainers`) are either a plain name or a name with one profile link. The link shows up in the index:

```yaml
authors:
  - Team1 Europe
  - name: Ada Example
    url: https://github.com/ada
```

## Archiving

Set `archived: true` in the original file when a workshop is no longer maintained. It stays in the repo, moves to the "Archived" table in the index, and is excluded from staleness reports.

## Licensing

By contributing you agree that workshop content is published under [CC BY 4.0](LICENSE) and code samples under [MIT](LICENSE-CODE). Only contribute material you have the right to license this way.

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
