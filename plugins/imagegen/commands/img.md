---
description: Alias of /imagegen. Generate an image from a prompt and save it under the workspace's standard image directory.
argument-hint: <prompt>
---

This is an alias for `/imagegen`. Follow the exact same dispatch + generation logic as `commands/imagegen.md`:

The user invoked `/imagegen:img` (alias for `/imagegen`) with the following arguments:

```
$ARGUMENTS
```

Trim `$ARGUMENTS`; strip one layer of surrounding `"…"` or `'…'` quotes. If the result is empty, ask once: "What should I generate?" and stop. Otherwise treat it as an image prompt and execute the generation steps from `commands/imagegen.md` Step 3:

1. Pick `save_path` per the SKILL's defaults table (`./public/images/` → `./public/` → `./assets/` → `./images/` → `./generated/<timestamp>-<slug>.png`).
2. Pick `size`: `1536x1024` for hero/banner/cover/og/wide/landscape; `1024x1536` for portrait/vertical/tall; otherwise `1024x1024`.
3. Pick `quality`: `high` for hero/final/print/brand; otherwise `medium`.
4. Pick `style`: `photoreal` if photo/photograph/realistic appear; otherwise `auto`.
5. Expand the prompt using the SKILL's templates. Do not show the expansion to the user.
6. Call `mcp__plugin_imagegen_imagegen__generate_image`.
7. On success: 1–2-sentence summary with path + dimensions.
8. On failure: surface the `hint` field, then a one-sentence next step.
