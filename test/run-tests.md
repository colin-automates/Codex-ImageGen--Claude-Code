# imagegen — end-to-end test runbook

Three tests, exactly matching the user-deliverable spec. Run them in order in a fresh Claude Code session inside the plugin's repo (so the plugin auto-loads).

Pre-req: `/imagegen setup` has reported all green at least once on this machine.

---

## Test 1 — auto-trigger (no slash command)

**Setup**: `test/fixtures/landing.html` already has an empty `<img src="">` with a real-looking alt and a TODO comment above it.

**Action**: open a fresh Claude Code session in the repo root and say:

> *"open test/fixtures/landing.html and make this landing page nicer"*

**Expected**:
1. Claude reads the file, identifies the empty `<img src>` slot, and **does not ask you for confirmation**.
2. The skill auto-fires `mcp__plugin_imagegen_imagegen__generate_image` with a hero-sized (1536×1024) photoreal mountain-sunrise prompt.
3. The image saves under `test/fixtures/public/images/<slug>.png` (or another reasonable default the SKILL picks; the dir is created if missing).
4. Claude **edits the HTML** so `<img src="">` becomes `<img src="/images/<slug>.png" alt="hero photo of a mountain sunrise">` (or equivalent).
5. Claude reports the result in 1–2 sentences.

**Pass criteria**:
- File exists on disk and is > 50KB (real image, not empty).
- HTML's `src=""` is now populated and the alt is intact.
- No "may I proceed?" / "should I generate?" prompt was shown.

**If the auto-fire didn't happen**: the SKILL.md `description` may not be matching. Inspect with `/plugin info imagegen` and re-read the description. The most common cause is that the file you opened doesn't have any of the trigger surfaces (empty `<img>`, TODO comment about an image, etc.) — make sure the fixture is in the state it ships in.

---

## Test 2 — explicit slash command

**Action**: in a fresh Claude Code session in the repo root:

```
/imagegen "sunset over mountains, photorealistic"
```

**Expected**:
1. Claude calls `mcp__plugin_imagegen_imagegen__generate_image` immediately.
2. File saves to `./images/<slug>.png` if `./images/` exists, or `./generated/<timestamp>-<slug>.png` otherwise.
3. Claude reports the path and dimensions in 1–2 sentences.

**Pass criteria**:
- File exists on disk and is > 50KB.
- Path is reported as part of the result.

---

## Test 3 — billing (manual, after Tests 1 & 2)

**Action**: open https://platform.openai.com/usage in a browser and check today's API spend.

**Expected**: $0.00 incremented since before Test 1.

**Pass criteria**: zero new API spend. (gpt-image via ChatGPT subscription is billed against ChatGPT plan limits, not the OpenAI API account.)

If you see non-zero spend, your Codex install fell back to the OpenAI API path (e.g., because the built-in `@imagegen` / gpt-image tool isn't available, or `codex login` was set up with an API key instead of ChatGPT). Re-run `/imagegen setup` and re-check the auth method it reports.

---

## Optional — `edit_image` smoke test

Pre-req: Test 1 left a hero image at `test/fixtures/public/images/<slug>.png`.

**Action**:
```
/imagegen:edit test/fixtures/public/images/<slug>.png make it more dramatic, add lightning over the peaks
```

**Expected**: a new file at `test/fixtures/public/images/<slug>-edited-<HHmmss>.png`, > 50KB.

---

## Optional — `generate_image_set` smoke test

```
/imagegen:set red enemy ship, top-down sprite | blue enemy ship, top-down sprite | green enemy ship, top-down sprite
```

**Expected**: three files in `./generated/set-<timestamp>/` (or another reasonable dir). Visually inspect — they should look like a coherent set (same lighting, line weight, palette breadth).
