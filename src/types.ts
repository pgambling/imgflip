export interface ImgflipConfig {
  /**
   * Imgflip account username. Required for `captionImage`. Not needed for
   * template listing; pass empty strings if you only plan to list templates.
   */
  username: string;
  /** Imgflip account password. Required for `captionImage`. */
  password: string;
  /**
   * Override the API base URL. Defaults to https://api.imgflip.com. Must be
   * HTTPS unless the host is localhost (HTTP localhost is allowed for tests).
   */
  baseUrl?: string;
  /** Custom fetch implementation. Defaults to the global fetch. */
  fetch?: typeof fetch;
  /** Request timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number;
}

export interface Template {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  boxCount: number;
}

export interface CaptionRequest {
  templateId: string;
  texts: string[];
  /** Optional font name supported by Imgflip (e.g. "impact", "arial"). */
  font?: string;
  /** Optional max font size in pixels. */
  maxFontSize?: number;
}

export interface CaptionResult {
  url: string;
  pageUrl: string;
}

export interface ImgflipClient {
  listTemplates(): Promise<Template[]>;
  searchTemplates(query: string): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  captionImage(request: CaptionRequest): Promise<CaptionResult>;
}
