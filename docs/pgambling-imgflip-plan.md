# Project Plan: @pgambling/imgflip

A TypeScript library, CLI, and Claude Code skill for generating Imgflip memes. Ships as a single npm package with three consumption modes: library (for bots and apps), CLI (for scripts and agents), and skill (for Claude Code).

## Goals

1. Publish a reusable npm package wrapping the Imgflip REST API with typed access to meme templates and captioning.
2. Ship a minimal CLI usable via `npx -y @pgambling/imgflip` with no install step.
3. Ship a Claude Code skill that uses the CLI to find templates and generate memes on demand.
4. Support integration into an existing Slack bot (Bun runtime, Docker, websocket connection, has its own LLM) via library import.

## Non-goals for v1

- No LLM integration in the library itself. Claude Code handles reasoning for the skill path; the Slack bot handles reasoning for the bot path.
- No web UI.
- No Imgflip Premium endpoints (`/automeme`, `/ai_meme`, `/search_memes`). Free-tier endpoints only.
- No image downloading, caching of rendered memes, or custom template uploads.
- No bundled template data. Every template list request hits the Imgflip API live.
- No caching in the library. Callers (like the Slack bot) cache on their own terms.
- No bundled bot implementations. The library is the integration point.

## Architecture

Single npm package, `@pgambling/imgflip`, with three public surfaces:

1. **Library** — TypeScript exports consumed via `import` for Node/Bun projects. Primary consumer: user's Slack bot.
2. **CLI** — `#!/usr/bin/env node` binary exposed via `bin` entry. Primary consumer: the Claude Code skill. Secondary: humans running it directly.
3. **Skill** — SKILL.md + supporting files shipped inside the package under `/skill/`, copyable into `~/.claude/skills/`.

All three share one core: the library. The CLI is a thin wrapper over the library. The skill invokes the CLI.

The library is stateless and fetches fresh data on every call. Consumers that want caching implement it themselves; this keeps the library honest about what it does and avoids the complexity of cache invalidation, TTLs, and stale-data bugs at the library level.

## Repository layout

- `src/` — library source (TypeScript, ESM)
  - `index.ts` — public exports
  - `client.ts` — `createImgflipClient` factory and API methods
  - `templates.ts` — template fetch and search helpers
  - `types.ts` — shared TypeScript types
  - `cli.ts` — CLI entry point
- `skill/` — shipped with the package
  - `SKILL.md` — skill manifest and instructions for Claude
  - `README.md` — how to install the skill
- `dist/` — tsc output, published to npm, gitignored
- `package.json`, `tsconfig.json`, `README.md`, `LICENSE` (MIT)

## Package configuration

- Package name: `@pgambling/imgflip` (scoped to the `pgambling` npm user).
- ESM only (`"type": "module"`)
- Node engines: `>=18` (for native `fetch`)
- `main` points to compiled library entry
- `types` points to compiled `.d.ts`
- `bin.imgflip` points to compiled CLI entry (short bin name despite scoped package name, so users type `imgflip` not the full scope)
- `files` includes `dist` and `skill`
- `publishConfig.access` set to `"public"` so `npm publish` treats the scoped package as free/public by default
- `prepublishOnly` script runs `tsc`
- Zero runtime dependencies

## Library API

High-level shape (finalize exact signatures during implementation):

- `createImgflipClient(config)` returns a client bound to Imgflip credentials.
- Client exposes async methods: `listTemplates()`, `searchTemplates(query)`, `getTemplate(id)`, `captionImage(request)`.
- `listTemplates()` returns `Promise<Template[]>` — hits `GET /get_memes`, no caching.
- `searchTemplates(query)` returns `Promise<Template[]>` — fetches list and filters by name (case-insensitive substring match).
- `getTemplate(id)` returns `Promise<Template | undefined>` — fetches list and finds by ID.
- `captionImage(request)` returns `Promise<CaptionResult>` — hits `POST /caption_image`, returns `{ url, pageUrl }`.
- All types exported from the package root: `ImgflipConfig`, `ImgflipClient`, `Template`, `CaptionRequest`, `CaptionResult`.
- Errors: throw on API failures with descriptive messages including the Imgflip `error_message` when available.

Design principles:

- Credentials are passed once at client creation, never per call.
- Only `captionImage` requires credentials. Template listing uses the unauthenticated `/get_memes` endpoint, but client methods require credentials to be set for simplicity — callers always create a client with credentials before using any method.
- Zero runtime dependencies beyond Node's built-in `fetch`. No axios, no commander, no yargs.
- Stateless: no caching, no persistent connections, no lazy initialization. Each method call is independent.

## CLI design

Two subcommands, both printing JSON to stdout.

- `imgflip templates [--search <query>] [--limit <n>]` — fetches current top templates from Imgflip, optionally filters by name substring and limits results, prints a JSON array.
- `imgflip caption <templateId> <text0> [text1] [text2...]` — captions a template and prints `{ url, pageUrl }` as JSON. Requires `IMGFLIP_USERNAME` and `IMGFLIP_PASSWORD` env vars.
- `imgflip --help` — prints usage summary.
- `imgflip --version` — prints package version.

When invoked via `npx`, the full scoped name is required: `npx -y @pgambling/imgflip templates`. When installed globally or used as a local dep, the short `imgflip` bin name works.

Design principles:

- JSON by default. No pretty-printing, no color codes, no progress bars. Claude parses the output.
- No CLI framework. Raw `process.argv` parsing, ~60 lines total.
- Clear error messages on missing credentials that tell the user exactly what to do (sign up link, env var names).
- Non-zero exit codes on any failure.
- Each invocation hits the Imgflip API fresh for template listings. No local cache.

## Claude Code skill design

The `skill/SKILL.md` file is the user-facing contract with Claude. It should:

- Have a tight YAML frontmatter with a `name` and a `description` that triggers on meme-related intents ("make a meme", "create a meme", "generate a meme image").
- Document the two CLI commands as the primary tools.
- Include a short "workflow" section: search → pick template → caption → return URL.
- Include guidelines on template selection (match by semantic fit, not just name keyword; respect box_count; keep text concise).
- Note that `templates` should be run fresh each task since the top 100 can change.
- Stay under ~100 lines. Progressive disclosure — Claude reads this only when the skill triggers.

The `skill/README.md` documents installation for end users: copy the folder to `~/.claude/skills/imgflip/`, set env vars, done.

## Testing strategy for v1

- Manual smoke tests against real Imgflip API during development using the author's credentials.
- One or two unit tests for `searchTemplates` filtering logic (mock the fetch call).
- Test the CLI end-to-end by running both subcommands locally and confirming valid JSON output and working image URLs.
- Test the skill by installing it into the author's Claude Code, triggering it with a meme request, and confirming the full flow works.
- No CI test matrix for v1. Add later if adoption warrants.

## Publishing and distribution

1. Initial local testing via `npm link` or direct path installs.
2. First publish to npm as `0.1.0` once CLI + library + skill are all working.
3. GitHub repo public, MIT license, README includes:
   - What it is, 30-second demo
   - Library usage example
   - CLI usage example
   - Skill installation instructions
   - Imgflip credential setup
4. Future versions: semver discipline. Breaking CLI arg changes require a major bump since Claude Code skills depend on stable invocation shape.

## Slack bot integration (out of scope for this project, documented for context)

The Slack bot imports `@pgambling/imgflip` as a dependency, creates one client at startup, and calls `captionImage` when its existing LLM decides a meme is the right response. The bot's LLM is responsible for selecting a `templateId` and generating the caption texts — it can do this by being given the current template list (fetched via `listTemplates()`) as part of its available tool schema or system prompt.

The bot is expected to cache the template list on its own terms (e.g., in-memory refresh every 24 hours) since it is a long-running process and would otherwise hit `/get_memes` more than needed. This caching is intentionally not the library's concern.

No changes to this project are needed to support this; the library API already covers it.

## Implementation order

1. Scaffold package: `package.json`, `tsconfig.json`, directory structure, gitignore.
2. Define types in `src/types.ts`.
3. Implement `src/templates.ts` — fetch from `/get_memes`, normalize to `Template` type, filter helpers.
4. Implement `src/client.ts` — `createImgflipClient`, `captionImage`.
5. Wire up `src/index.ts` exports.
6. Implement `src/cli.ts` with both subcommands and help text.
7. Manually test library and CLI end-to-end with real Imgflip credentials.
8. Write `skill/SKILL.md` and `skill/README.md`.
9. Install the skill locally, test the full Claude Code flow.
10. Write top-level `README.md` covering all three usage modes.
11. Configure `prepublishOnly`, publish `0.1.0` to npm.

## Open decisions to confirm before coding

- Whether to use tsc directly or Bun's build for producing `dist/`. Tsc is more conventional for published libraries; Bun is faster. Either works; recommendation is tsc for the conventional npm publish path.
- Whether the `captionImage` signature should take a single `texts: string[]` array or named `text0`, `text1` fields. Array is cleaner and more ergonomic for variable-box-count templates; named fields match Imgflip's raw API exactly. Recommendation: array.
- Whether `searchTemplates` should match on template name only or also on id. Recommendation: name only for v1; add id-prefix matching later if users request it.
