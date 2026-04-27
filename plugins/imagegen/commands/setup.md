---
description: One-time setup probe. Verifies Codex CLI is installed and authenticated (auto-launching browser sign-in if needed), then runs a small imagegen test to confirm the full pipeline works.
---

The user invoked `/imagegen:setup` (also reachable as `/imagegen setup`). Run these steps in order, reporting clearly at each one:

### Step 1 — Codex on PATH

Run `codex --version` via Bash.

- If it succeeds, note the version and continue.
- If it fails with "command not found" / ENOENT: tell the user to install Codex with:
  ```
  npm install -g @openai/codex
  ```
  Do **not** run that install command yourself — global npm installs may need elevated permissions on Windows/macOS, and the user should run it interactively. Stop the setup probe; tell the user to re-run `/imagegen setup` after installing.

### Step 2 — Codex auth

Run `codex login status` via Bash.

**If output contains "Logged in"** (any form): note the auth method ("ChatGPT" or "API key") and continue to Step 3.

**If output is "Not logged in"**: auto-launch the sign-in flow in a new terminal window and poll for completion. Tell the user one short sentence first ("Opening a browser sign-in window — complete it and I'll continue automatically"), then run this **one** Bash command with `timeout_ms = 240000` (4 minutes):

```bash
# Spawn codex login in a new visible terminal so the user can interact with it
OS=$(uname -s 2>/dev/null || echo unknown)
case "$OS" in
  MINGW*|MSYS*|CYGWIN*)
    powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/k','codex','login'" ;;
  Darwin)
    osascript -e 'tell application "Terminal" to do script "codex login"' >/dev/null ;;
  Linux)
    (x-terminal-emulator -e codex login &) 2>/dev/null \
      || (gnome-terminal -- codex login &) 2>/dev/null \
      || (xterm -e codex login &) 2>/dev/null \
      || (codex login &) ;;
  *)
    codex login & ;;
esac

# Poll codex login status every 5s for up to 3 minutes.
# Anchor on start-of-line so "Logged in" doesn't false-match inside "Not logged in".
for i in $(seq 1 36); do
  status=$(codex login status 2>&1)
  if echo "$status" | grep -qiE '^[[:space:]]*Logged in'; then
    echo "AUTH_COMPLETE"
    echo "$status"
    exit 0
  fi
  sleep 5
done
echo "AUTH_TIMEOUT"
codex login status
```

After the command returns:
- If output contains `AUTH_COMPLETE`: extract the auth method from the final `Logged in using …` line and continue to Step 3.
- If output contains `AUTH_TIMEOUT`: tell the user "Sign-in window stayed open longer than 3 minutes. Finish the browser flow at your own pace, then re-run `/imagegen setup`." Stop the setup probe.

### Step 3 — Probe image generation

First resolve a save path **outside the user's project** so the probe doesn't litter their repo. Run this Bash one-liner and capture stdout:

```bash
echo "${CLAUDE_PLUGIN_DATA:-$HOME/.cache/imagegen}/setup-probe.png"
```

Use that string as `save_path` in the MCP call below. Then call `mcp__plugin_imagegen_imagegen__generate_image` with:
- `prompt`: `"a small flat-vector red square centered on a plain white background, simple test image"`
- `save_path`: the path captured above (an absolute path outside the user's workspace).
- `size`: `"1024x1024"`
- `quality`: `"low"`
- `timeout_ms`: `120000`

If you observe a permission prompt before the call goes through (i.e., Claude Code asks the user to approve `mcp__plugin_imagegen_imagegen__generate_image`), note that as a finding and tell the user to either:
- Approve once, then run this command once with the toggle to "always allow," or
- Run `/permissions add mcp__plugin_imagegen_imagegen__*` to pre-approve, or
- Copy the entries from this plugin's `settings.json` into their `~/.claude/settings.local.json`.

### Step 4 — Report

Print a concise report:
- Codex version
- Auth method (ChatGPT or API key)
- Probe result: success path + file size, or the failure code + hint
- Total time taken
- Next-step note: if everything passed, tell the user they can now invoke `/imagegen "<prompt>"`, `/imagegen:edit <path> <prompt>`, or describe an image and the skill will auto-fire (multi-image requests auto-route to set mode).

If the probe succeeded, the setup is complete.
