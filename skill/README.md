# imgflip skill for Claude Code

This folder is a Claude Code skill that lets Claude generate memes via the Imgflip API.

## Install

The easiest way is the CLI, which copies this folder to `~/.claude/skills/imgflip/`:

```sh
npx -y @pgambling/imgflip install-skill
# overwrite an existing install:
npx -y @pgambling/imgflip install-skill --force
# or pick a custom destination:
npx -y @pgambling/imgflip install-skill --dest ~/some/other/path
```

Manual alternative, if you prefer:

```sh
mkdir -p ~/.claude/skills
cp -R "$(npm root -g)/@pgambling/imgflip/skill" ~/.claude/skills/imgflip
```

## Credentials

The `caption` command needs Imgflip API credentials. Sign up at
<https://imgflip.com/signup> (free), then add to your shell profile:

```sh
export IMGFLIP_USERNAME="your-username"
export IMGFLIP_PASSWORD="your-password"
```

## Verify

In a Claude Code session, ask: "Make a meme about Monday mornings." The skill
should trigger, call `imgflip templates`, pick one, caption it, and return a URL.

No separate install is required for the CLI itself — the skill invokes it via
`npx -y @pgambling/imgflip ...` on demand. If you prefer a global install:

```sh
npm install -g @pgambling/imgflip
```

Then the skill will find the `imgflip` bin on `PATH`.
