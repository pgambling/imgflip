#!/usr/bin/env node
import { cpSync, existsSync, lstatSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createImgflipClient } from "./client.js";
import { filterTemplatesByName } from "./templates.js";
import type { Template } from "./types.js";

const USAGE = `imgflip — generate memes via the Imgflip API

Usage:
  imgflip templates [--search <query>] [--limit <n>]
  imgflip caption <templateId> <text0> [text1] [text2...] [--font <name>] [--max-font-size <px>]
  imgflip install-skill [--dest <path>] [--force]
  imgflip --help
  imgflip --version

Flags accept \`--key value\` or \`--key=value\`. Use \`--\` to stop flag parsing,
e.g. \`imgflip caption 123 -- "--suspicious text"\`.

Environment:
  IMGFLIP_USERNAME   required for 'caption'
  IMGFLIP_PASSWORD   required for 'caption'

Sign up for free credentials at https://imgflip.com/signup.

Output is always JSON on stdout. Errors go to stderr with a non-zero exit code.`;

function die(message: string, code = 1): never {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function readVersion(): string {
  try {
    // Assumes compiled CLI lives at <pkg>/dist/cli.js, so package.json is one up.
    const pkgUrl = new URL("../package.json", import.meta.url);
    const raw = readFileSync(fileURLToPath(pkgUrl), "utf8");
    return (JSON.parse(raw) as { version: string }).version;
  } catch {
    return "0.0.0";
  }
}

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | boolean>;
}

interface FlagSpec {
  valueFlags: ReadonlySet<string>;
  booleanFlags: ReadonlySet<string>;
}

function parseArgs(args: string[], spec: FlagSpec): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let i = 0;
  while (i < args.length) {
    const arg = args[i]!;
    if (arg === "--") {
      positional.push(...args.slice(i + 1));
      break;
    }
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        const key = arg.slice(2, eq);
        if (!spec.valueFlags.has(key) && !spec.booleanFlags.has(key)) {
          die(`Unknown flag: --${key}`);
        }
        flags[key] = arg.slice(eq + 1);
        i++;
        continue;
      }
      const key = arg.slice(2);
      if (spec.valueFlags.has(key)) {
        const next = args[i + 1];
        if (next === undefined) die(`Flag --${key} requires a value.`);
        flags[key] = next;
        i += 2;
        continue;
      }
      if (spec.booleanFlags.has(key)) {
        flags[key] = true;
        i++;
        continue;
      }
      die(`Unknown flag: --${key}`);
    }
    positional.push(arg);
    i++;
  }
  return { positional, flags };
}

async function runTemplates(rest: string[]): Promise<void> {
  const { positional, flags } = parseArgs(rest, {
    valueFlags: new Set(["search", "limit"]),
    booleanFlags: new Set(),
  });
  if (positional.length > 0) {
    die(`Unexpected positional arguments for 'templates': ${positional.join(" ")}`);
  }

  const client = createImgflipClient({
    username: process.env["IMGFLIP_USERNAME"] ?? "",
    password: process.env["IMGFLIP_PASSWORD"] ?? "",
  });

  let templates: Template[] = await client.listTemplates();

  const search = flags["search"];
  if (typeof search === "string") {
    templates = filterTemplatesByName(templates, search);
  }

  const limitRaw = flags["limit"];
  if (typeof limitRaw === "string") {
    const limit = Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(limit) || limit < 0) {
      die(`Invalid --limit value: ${limitRaw}`);
    }
    templates = templates.slice(0, limit);
  }

  process.stdout.write(`${JSON.stringify(templates)}\n`);
}

async function runCaption(rest: string[]): Promise<void> {
  const { positional, flags } = parseArgs(rest, {
    valueFlags: new Set(["font", "max-font-size"]),
    booleanFlags: new Set(),
  });

  const [templateId, ...texts] = positional;
  if (!templateId) die("Usage: imgflip caption <templateId> <text0> [text1...]");
  if (texts.length === 0) die("At least one text argument is required.");

  const username = process.env["IMGFLIP_USERNAME"];
  const password = process.env["IMGFLIP_PASSWORD"];
  if (!username || !password) {
    die(
      "Missing credentials. Set IMGFLIP_USERNAME and IMGFLIP_PASSWORD " +
        "(sign up at https://imgflip.com/signup).",
    );
  }

  const client = createImgflipClient({ username, password });
  const font = typeof flags["font"] === "string" ? flags["font"] : undefined;
  const maxFontSizeRaw = flags["max-font-size"];
  const maxFontSize =
    typeof maxFontSizeRaw === "string" ? Number.parseInt(maxFontSizeRaw, 10) : undefined;
  if (maxFontSize !== undefined && (!Number.isFinite(maxFontSize) || maxFontSize <= 0)) {
    die(`Invalid --max-font-size value: ${String(maxFontSizeRaw)}`);
  }

  const result = await client.captionImage({ templateId, texts, font, maxFontSize });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function runInstallSkill(rest: string[]): void {
  const { positional, flags } = parseArgs(rest, {
    valueFlags: new Set(["dest"]),
    booleanFlags: new Set(["force"]),
  });
  if (positional.length > 0) {
    die(`Unexpected positional arguments for 'install-skill': ${positional.join(" ")}`);
  }

  const skillSrcUrl = new URL("../skill", import.meta.url);
  const source = fileURLToPath(skillSrcUrl);
  if (!existsSync(source)) {
    die(`Bundled skill directory not found at ${source}. Reinstall the package.`);
  }

  const destFlag = flags["dest"];
  const dest = resolve(
    typeof destFlag === "string" ? destFlag : join(homedir(), ".claude", "skills", "imgflip"),
  );
  const force = flags["force"] === true;

  if (existsSync(dest)) {
    const stat = lstatSync(dest);
    if (stat.isSymbolicLink()) {
      die(`Refusing to write to symlink: ${dest}. Remove it manually if intended.`);
    }
    if (!stat.isDirectory()) {
      die(`Destination exists and is not a directory: ${dest}`);
    }
    if (!force) {
      die(`Destination already exists: ${dest}\nPass --force to overwrite.`);
    }
    rmSync(dest, { recursive: true });
  }

  cpSync(source, dest, { recursive: true });
  process.stdout.write(`${JSON.stringify({ installed: true, source, dest })}\n`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  if (argv[0] === "--version" || argv[0] === "-v") {
    process.stdout.write(`${readVersion()}\n`);
    return;
  }

  const [subcommand, ...rest] = argv;
  switch (subcommand) {
    case "templates":
      await runTemplates(rest);
      return;
    case "caption":
      await runCaption(rest);
      return;
    case "install-skill":
      runInstallSkill(rest);
      return;
    default:
      die(`Unknown command: ${subcommand}\n\n${USAGE}`);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  die(message);
});
