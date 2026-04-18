import type { Template } from "./types.js";
import { fetchJson } from "./http.js";

interface RawTemplate {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  box_count: number;
}

interface GetMemesResponse {
  success: boolean;
  data?: { memes: RawTemplate[] };
  error_message?: string;
}

export async function fetchTemplates(
  baseUrl: string,
  fetchImpl: typeof fetch,
  timeoutMs?: number,
): Promise<Template[]> {
  const body = await fetchJson<GetMemesResponse>(
    `${baseUrl}/get_memes`,
    { method: "GET" },
    fetchImpl,
    timeoutMs,
  );
  if (!body.success || !body.data) {
    throw new Error(
      `Imgflip /get_memes returned failure${body.error_message ? `: ${body.error_message}` : ""}`,
    );
  }
  return body.data.memes.map(normalizeTemplate);
}

export function normalizeTemplate(raw: RawTemplate): Template {
  return {
    id: raw.id,
    name: raw.name,
    url: raw.url,
    width: raw.width,
    height: raw.height,
    boxCount: raw.box_count,
  };
}

export function filterTemplatesByName(templates: Template[], query: string): Template[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return templates;
  return templates.filter((t) => t.name.toLowerCase().includes(needle));
}
