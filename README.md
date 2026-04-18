# @pgambling/imgflip

TypeScript library, CLI, and Claude Code skill for generating [Imgflip](https://imgflip.com) memes.

One package, three ways to use it:

- **Library** — `import { createImgflipClient } from "@pgambling/imgflip"`
- **CLI** — `npx -y @pgambling/imgflip templates`
- **Claude Code skill** — drop `./skill` into `~/.claude/skills/imgflip/`

Zero runtime dependencies. ESM. Node 18+. Stateless — no caching.

## Install

```sh
npm install @pgambling/imgflip
# or, for CLI-only use, no install needed:
npx -y @pgambling/imgflip --help
```

## Credentials

Captioning requires a free Imgflip account. Note: Imgflip's API uses your account
**username and password** (it does not issue API keys or tokens). Sign up at
<https://imgflip.com/signup>, then set environment variables:

```sh
export IMGFLIP_USERNAME="your-username"
export IMGFLIP_PASSWORD="your-password"
```

Windows PowerShell: `$env:IMGFLIP_USERNAME="..."`. Any dotenv/direnv-style loader
works — the library itself just reads whatever you pass to `createImgflipClient`.

Template listing (`/get_memes`) does not require credentials, so you can pass
empty strings if you only plan to call `listTemplates` / `searchTemplates` /
`getTemplate`. `captionImage` will throw a clear error if credentials are missing.

## Library

```ts
import { createImgflipClient } from "@pgambling/imgflip";
import type { Template, CaptionRequest, CaptionResult } from "@pgambling/imgflip";

const client = createImgflipClient({
  username: process.env.IMGFLIP_USERNAME!,
  password: process.env.IMGFLIP_PASSWORD!,
  // Optional: custom timeoutMs, baseUrl (must be HTTPS), or fetch (for tests)
});

const templates = await client.searchTemplates("drake");
const drake = templates[0];

const meme = await client.captionImage({
  templateId: drake.id,
  texts: ["Writing tests by hand", "Asking Claude to write tests"],
});

console.log(meme.url);      // https://i.imgflip.com/...
console.log(meme.pageUrl);  // https://imgflip.com/i/...
```

### API

- `createImgflipClient(config: ImgflipConfig): ImgflipClient`
- `client.listTemplates(): Promise<Template[]>`
- `client.searchTemplates(query): Promise<Template[]>` — case-insensitive substring on name
- `client.getTemplate(id): Promise<Template | undefined>`
- `client.captionImage(request: CaptionRequest): Promise<CaptionResult>`

All calls hit the Imgflip API fresh; there is no built-in cache. If you're embedding this
in a long-running process (like a Slack bot), cache template listings on your own terms.
`searchTemplates` and `getTemplate` each issue a full `/get_memes` request — do not call
them in a loop; fetch once and filter in memory.

Testability: the optional `fetch` config lets you inject a stub in unit tests without
network access. See `test/client.test.ts` for an example.

## Troubleshooting

- **"Missing credentials"** — export `IMGFLIP_USERNAME` and `IMGFLIP_PASSWORD`, or pass
  them to `createImgflipClient`.
- **"baseUrl must use HTTPS"** — the client refuses non-HTTPS base URLs except for
  `localhost` (for local test servers). Imgflip is HTTPS-only.
- **"Imgflip request timed out"** — the default request timeout is 30 seconds. Pass
  `timeoutMs` on the client config to raise or lower it.
- **Rate limits** — Imgflip throttles anonymous / free requests. If `captionImage`
  starts failing with `Too many requests`, back off or reduce polling frequency. The
  library surfaces Imgflip's `error_message` verbatim (with your credentials redacted).
- **Box count mismatch** — if you supply more or fewer `texts` than the template's
  `boxCount`, Imgflip returns an opaque error. Check `template.boxCount` first.

## CLI

```sh
# List top templates (JSON on stdout)
npx -y @pgambling/imgflip templates

# Filter and limit
npx -y @pgambling/imgflip templates --search drake --limit 5

# Caption a template (requires IMGFLIP_USERNAME / IMGFLIP_PASSWORD)
npx -y @pgambling/imgflip caption 181913649 "Top text" "Bottom text"
```

All output is JSON. Non-zero exit code on failure. Install globally (`npm i -g`) or
locally to use the short `imgflip` binary name.

## Claude Code skill

Install the bundled skill directly via the CLI:

```sh
npx -y @pgambling/imgflip install-skill
# overwrite an existing install:
npx -y @pgambling/imgflip install-skill --force
# or pick a custom destination:
npx -y @pgambling/imgflip install-skill --dest ~/some/other/path
```

This copies the bundled `skill/` folder to `~/.claude/skills/imgflip/`. See
[`skill/README.md`](./skill/README.md) for credential setup. Once installed,
Claude Code triggers the skill on meme-related prompts and drives the CLI
end-to-end.

## License

MIT © Phil Gambling
