import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createImgflipClient } from "../src/client.js";
import { filterTemplatesByName } from "../src/templates.js";
import { redactSecrets, assertSafeBaseUrl } from "../src/http.js";
import type { Template } from "../src/types.js";

const fakeMemes = [
  { id: "1", name: "Drake Hotline Bling", url: "u1", width: 1, height: 1, box_count: 2 },
  { id: "2", name: "Distracted Boyfriend", url: "u2", width: 1, height: 1, box_count: 3 },
  { id: "3", name: "drakeish knock-off", url: "u3", width: 1, height: 1, box_count: 2 },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeFetch(
  responses: Record<string, unknown>,
  capture?: { lastUrl?: string; lastBody?: string },
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (capture) {
      capture.lastUrl = url;
      capture.lastBody = typeof init?.body === "string" ? init.body : undefined;
    }
    const key = Object.keys(responses).find((k) => url.includes(k));
    if (!key) throw new Error(`Unexpected fetch: ${url}`);
    return jsonResponse(responses[key]);
  }) as typeof fetch;
}

test("searchTemplates does case-insensitive substring match on name", async () => {
  const client = createImgflipClient({
    username: "u",
    password: "p",
    fetch: fakeFetch({ "/get_memes": { success: true, data: { memes: fakeMemes } } }),
  });

  const results = await client.searchTemplates("DRAKE");
  assert.deepEqual(
    results.map((t) => t.id),
    ["1", "3"],
  );
});

test("filterTemplatesByName with empty query returns all templates", () => {
  const templates: Template[] = fakeMemes.map((m) => ({
    id: m.id,
    name: m.name,
    url: m.url,
    width: m.width,
    height: m.height,
    boxCount: m.box_count,
  }));
  assert.equal(filterTemplatesByName(templates, "   ").length, 3);
});

test("getTemplate returns undefined when id not found", async () => {
  const client = createImgflipClient({
    username: "u",
    password: "p",
    fetch: fakeFetch({ "/get_memes": { success: true, data: { memes: fakeMemes } } }),
  });

  assert.equal(await client.getTemplate("999"), undefined);
  const hit = await client.getTemplate("2");
  assert.equal(hit?.name, "Distracted Boyfriend");
  assert.equal(hit?.boxCount, 3);
});

test("captionImage throws with Imgflip error_message on failure", async () => {
  const client = createImgflipClient({
    username: "u",
    password: "p",
    fetch: fakeFetch({
      "/caption_image": { success: false, error_message: "Invalid template_id" },
    }),
  });

  await assert.rejects(
    () => client.captionImage({ templateId: "x", texts: ["a", "b"] }),
    /Invalid template_id/,
  );
});

test("captionImage returns normalized result on success", async () => {
  const client = createImgflipClient({
    username: "u",
    password: "p",
    fetch: fakeFetch({
      "/caption_image": {
        success: true,
        data: { url: "https://i.imgflip.com/x.jpg", page_url: "https://imgflip.com/i/x" },
      },
    }),
  });

  const result = await client.captionImage({ templateId: "1", texts: ["top", "bot"] });
  assert.deepEqual(result, {
    url: "https://i.imgflip.com/x.jpg",
    pageUrl: "https://imgflip.com/i/x",
  });
});

test("listTemplates works without credentials", async () => {
  const client = createImgflipClient({
    username: "",
    password: "",
    fetch: fakeFetch({ "/get_memes": { success: true, data: { memes: fakeMemes } } }),
  });
  const all = await client.listTemplates();
  assert.equal(all.length, 3);
});

test("captionImage without credentials throws a clear error", async () => {
  const client = createImgflipClient({
    username: "",
    password: "",
    fetch: fakeFetch({ "/caption_image": { success: true } }),
  });
  await assert.rejects(
    () => client.captionImage({ templateId: "1", texts: ["a"] }),
    /requires Imgflip credentials/,
  );
});

test("createImgflipClient rejects non-HTTPS baseUrl", () => {
  assert.throws(
    () =>
      createImgflipClient({
        username: "u",
        password: "p",
        baseUrl: "http://evil.example",
      }),
    /must use HTTPS/,
  );
});

test("createImgflipClient allows http://localhost for testing", () => {
  createImgflipClient({
    username: "u",
    password: "p",
    baseUrl: "http://localhost:8080",
  });
});

test("captionImage redacts credentials from thrown error messages", async () => {
  const password = "hunter2secret";
  const client = createImgflipClient({
    username: "leaky",
    password,
    fetch: fakeFetch({
      "/caption_image": {
        success: false,
        error_message: `rejected: password=${password} is invalid`,
      },
    }),
  });

  await assert.rejects(
    () => client.captionImage({ templateId: "1", texts: ["a"] }),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      assert.ok(!msg.includes(password), `password leaked: ${msg}`);
      assert.ok(msg.includes("[REDACTED]"), `expected redaction in: ${msg}`);
      return true;
    },
  );
});

test("redactSecrets ignores short/empty secrets", () => {
  assert.equal(redactSecrets("hello world", "", undefined, "he"), "hello world");
});

test("assertSafeBaseUrl accepts https and localhost http only", () => {
  assertSafeBaseUrl("https://api.imgflip.com");
  assertSafeBaseUrl("http://localhost");
  assertSafeBaseUrl("http://127.0.0.1:3000");
  assert.throws(() => assertSafeBaseUrl("http://example.com"), /must use HTTPS/);
  assert.throws(() => assertSafeBaseUrl("ftp://example.com"), /must use HTTPS/);
  assert.throws(() => assertSafeBaseUrl("not-a-url"), /Invalid baseUrl/);
});

test("captionImage posts form body with boxes and credentials", async () => {
  const capture: { lastUrl?: string; lastBody?: string } = {};
  const client = createImgflipClient({
    username: "u",
    password: "p",
    fetch: fakeFetch(
      {
        "/caption_image": {
          success: true,
          data: { url: "https://i.imgflip.com/x.jpg", page_url: "https://imgflip.com/i/x" },
        },
      },
      capture,
    ),
  });

  await client.captionImage({ templateId: "42", texts: ["top", "bot"] });
  assert.ok(capture.lastUrl?.endsWith("/caption_image"));
  const body = new URLSearchParams(capture.lastBody);
  assert.equal(body.get("template_id"), "42");
  assert.equal(body.get("username"), "u");
  assert.equal(body.get("password"), "p");
  assert.equal(body.get("boxes[0][text]"), "top");
  assert.equal(body.get("boxes[1][text]"), "bot");
});
