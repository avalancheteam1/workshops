## Type

- [ ] New workshop (`workshops/<slug>/<lang>/`)
- [ ] Translation (`workshops/<slug>/<lang>/`)
- [ ] Improvement to an existing workshop
- [ ] Repository / tooling

## Checklist

- [ ] Followed `templates/workshop/README.md` (frontmatter; Overview, Prerequisites, Workshop, Resources present)
- [ ] Frontmatter complete: `title`, `language`, `authors`, `level`, `duration`, `last_updated`
- [ ] All links and image paths checked
- [ ] Translation only: `translated_from: <lang>@<date>` matches the source file's language and `last_updated`
- [ ] Improvement only: `last_updated` bumped
- [ ] `python3 scripts/validate.py` passes locally (optional - CI runs it too)
- [ ] I did not edit `README.md` (it is generated)

## Notes

<!-- Anything a reviewer should know: what changed, what was tested, open questions. -->
