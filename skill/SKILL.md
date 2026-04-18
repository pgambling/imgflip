---
name: imgflip
description: Generate Imgflip memes. Triggers on requests like "make a meme", "create a meme", "generate a meme image", "meme about X", "turn X into a meme", or "that deserves a meme".
---

# imgflip

Generate memes via the Imgflip API using the `imgflip` CLI (installed from `@pgambling/imgflip`).

## Tools

Two CLI subcommands, both return JSON on stdout:

- `npx -y @pgambling/imgflip templates [--search <query>] [--limit <n>]` — list current top templates. Use `--search` to filter by name substring (case-insensitive). Use `--limit` to cap results.
- `npx -y @pgambling/imgflip caption <templateId> <text0> [text1...] [--font impact|arial] [--max-font-size <px>]` — caption a template. Requires `IMGFLIP_USERNAME` and `IMGFLIP_PASSWORD` env vars.

If `imgflip` is installed locally or globally, drop the `npx -y @pgambling/imgflip` prefix.

## Workflow

1. **Fetch templates fresh.** Run `imgflip templates` (optionally with `--search` and `--limit`) at the start of each task. The top 100 changes — never rely on a cached list.
2. **Pick a template.** Match by semantic fit to the user's concept, not just keyword overlap. Respect `boxCount` — that's the number of text boxes the template accepts. Do not pick a template whose `boxCount` does not match the number of caption lines you intend to supply. If no template fits (empty search results, or no `boxCount` match), tell the user what you searched for and ask them to rephrase or accept a looser match — don't force a bad meme.
3. **Caption it.** Pass one text argument per box, in order. Keep text concise — meme text is short by convention and long strings wrap poorly.
4. **Return the URL.** Present the `url` from the caption response to the user. `pageUrl` is the Imgflip permalink if they want to share or remix it.

## Guidelines

- **Template selection:** prefer well-known templates whose visual joke matches the user's intent. If nothing fits, say so rather than forcing a poor match.
- **Box count:** if `boxCount` is 2, supply exactly 2 texts. Fewer is allowed (empty boxes) but the joke usually needs them all.
- **Text length:** aim for under ~40 characters per box. Longer text shrinks and may not render legibly.
- **No AI endpoints:** this skill uses free-tier endpoints only. Do not attempt `/automeme` or `/ai_meme`.
- **Credentials:** if captioning fails with a credentials error, tell the user to set `IMGFLIP_USERNAME` and `IMGFLIP_PASSWORD` (free signup at https://imgflip.com/signup).

## Example

User: "Make a meme about deploying on Friday."

1. `imgflip templates --search "distracted"` → find "Distracted Boyfriend" (id `112126428`, boxCount 3).
2. `imgflip caption 112126428 "me" "deploying on friday" "the weekend"` → returns `{"url": "...", "pageUrl": "..."}`.
3. Show the `url` to the user.
