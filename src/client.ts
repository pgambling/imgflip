import type {
  CaptionRequest,
  CaptionResult,
  ImgflipClient,
  ImgflipConfig,
  Template,
} from "./types.js";
import { fetchTemplates, filterTemplatesByName } from "./templates.js";
import { assertSafeBaseUrl, fetchJson, redactSecrets } from "./http.js";

const DEFAULT_BASE_URL = "https://api.imgflip.com";

interface CaptionResponse {
  success: boolean;
  data?: { url: string; page_url: string };
  error_message?: string;
}

export function createImgflipClient(config: ImgflipConfig): ImgflipClient {
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  assertSafeBaseUrl(baseUrl);
  const fetchImpl = config.fetch ?? fetch;
  const timeoutMs = config.timeoutMs;

  async function listTemplates(): Promise<Template[]> {
    return fetchTemplates(baseUrl, fetchImpl, timeoutMs);
  }

  async function searchTemplates(query: string): Promise<Template[]> {
    const all = await listTemplates();
    return filterTemplatesByName(all, query);
  }

  async function getTemplate(id: string): Promise<Template | undefined> {
    const all = await listTemplates();
    return all.find((t) => t.id === id);
  }

  async function captionImage(request: CaptionRequest): Promise<CaptionResult> {
    if (!config.username || !config.password) {
      throw new Error(
        "captionImage requires Imgflip credentials. " +
          "Set username and password on the client (sign up at https://imgflip.com/signup).",
      );
    }
    if (!request.templateId) {
      throw new Error("captionImage requires a templateId.");
    }
    if (!Array.isArray(request.texts) || request.texts.length === 0) {
      throw new Error("captionImage requires at least one text in texts.");
    }

    const body = new URLSearchParams();
    body.set("template_id", request.templateId);
    body.set("username", config.username);
    body.set("password", config.password);
    request.texts.forEach((text, i) => {
      body.set(`boxes[${i}][text]`, text);
    });
    if (request.font) body.set("font", request.font);
    if (request.maxFontSize != null) body.set("max_font_size", String(request.maxFontSize));

    let data: CaptionResponse;
    try {
      data = await fetchJson<CaptionResponse>(
        `${baseUrl}/caption_image`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        },
        fetchImpl,
        timeoutMs,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(redactSecrets(msg, config.username, config.password));
    }

    if (!data.success || !data.data) {
      const raw = data.error_message
        ? `Imgflip /caption_image returned failure: ${data.error_message}`
        : "Imgflip /caption_image returned failure";
      throw new Error(redactSecrets(raw, config.username, config.password));
    }

    return { url: data.data.url, pageUrl: data.data.page_url };
  }

  return { listTemplates, searchTemplates, getTemplate, captionImage };
}
