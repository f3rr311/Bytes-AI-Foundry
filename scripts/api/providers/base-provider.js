/**
 * Shared OpenAI-compatible request handler used by all text providers.
 */

let _lastErrorNotice = { msg: "", t: 0 };

/**
 * Surface a concise, actionable error notification in-game (beyond the F12
 * console) when a text provider request fails. De-dupes identical messages
 * within a short window so one failed generation doesn't spam several toasts.
 * @param {string} providerName — e.g. "OpenAI", "xAI", "Anthropic"
 * @param {number} status — HTTP status code
 * @param {string} errorBody — raw response body text
 */
export function notifyProviderError(providerName, status, errorBody) {
  let detail = "";
  try {
    const parsed = JSON.parse(errorBody);
    detail = parsed?.error?.message
      || (typeof parsed?.error === "string" ? parsed.error : "")
      || parsed?.message || "";
  } catch { /* non-JSON body — leave detail blank */ }

  const hint = (status === 401 || status === 403)
    ? "Check this provider's API key in module settings."
    : /model/i.test(`${detail} ${errorBody}`)
      ? "Check the model name in module settings (Text AI Provider section)."
      : "Check the model name and API key in module settings.";

  const msg = `Bytes AI — ${providerName} error ${status}: ${detail || "request failed"}. ${hint}`;
  const now = Date.now();
  if (msg === _lastErrorNotice.msg && now - _lastErrorNotice.t < 5000) return;
  _lastErrorNotice = { msg, t: now };
  globalThis.ui?.notifications?.error(msg);
}

// ─── OpenAI-Compatible Chat Completion ───

/**
 * Send a chat completion request to any OpenAI-compatible endpoint.
 * Handles body construction, fetch, response parsing, and error logging.
 *
 * @param {object} opts
 * @param {string} opts.endpoint — full URL to the chat completions endpoint
 * @param {object} opts.headers — pre-built headers (Content-Type + auth)
 * @param {string} opts.model — model name (e.g. "gpt-4.1", "claude-sonnet-4-20250514")
 * @param {string} opts.systemPrompt — system-level instructions
 * @param {string} opts.userPrompt — user-level prompt text
 * @param {number} opts.maxTokens — max tokens to generate
 * @param {boolean} [opts.useJsonMode=false] — request JSON response format
 * @param {string} [opts.providerName="API"] — provider name for error messages
 * @param {string} [opts.tokenParam="max_tokens"] — body field for the token limit.
 *   OpenAI's newer models (GPT-5.x / o-series) reject "max_tokens" and require
 *   "max_completion_tokens"; other OpenAI-compatible servers still expect "max_tokens".
 * @returns {Promise<{text: string|null, usage: object|null}>}
 */
export async function makeOpenAICompatibleRequest({
  endpoint, headers, model, systemPrompt, userPrompt,
  maxTokens, useJsonMode = false, providerName = "API", tokenParam = "max_tokens"
}) {
  if (!model) return { text: null, usage: null };

  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    [tokenParam]: maxTokens
  };

  if (useJsonMode) {
    body.response_format = { type: "json_object" };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(`${providerName} chat API error ${response.status}: ${errorBody}`);
      notifyProviderError(providerName, response.status, errorBody);
      return { text: null, usage: null };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || null;
    const usage = data.usage || null;

    return { text, usage };
  } catch (err) {
    console.error(`${providerName} chat request failed:`, err.message);
    return { text: null, usage: null };
  }
}
