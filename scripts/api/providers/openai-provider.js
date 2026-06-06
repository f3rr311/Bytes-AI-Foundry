/**
 * OpenAI text provider — the default provider.
 */

import { makeOpenAICompatibleRequest } from './base-provider.js';

// ─── Provider Definition ───

export const openaiProvider = {
  id: "openai",
  name: "OpenAI",
  requiresApiKey: true,
  supportsJsonMode: true,
  supportsImageGeneration: true,
  defaultEndpoint: "https://api.openai.com/v1/chat/completions",
  defaultModels: { chat: "gpt-5.5", light: "gpt-5.4-mini" },
  modelChoices: {
    "gpt-5.5": "GPT-5.5 (Best Quality)",
    "gpt-5.4-mini": "GPT-5.4 Mini (Good Quality, Cheaper)",
    "gpt-5.4-nano": "GPT-5.4 Nano (Basic, Cheapest)",
    "gpt-4.1": "GPT-4.1 (Legacy)",
    "gpt-4o-mini": "GPT-4o Mini (Legacy, Cheap)"
  },

  /**
   * OpenAI prompts are already optimized — no adjustments needed.
   * @param {string} systemPrompt
   * @param {boolean} _useJsonMode
   * @returns {string}
   */
  adjustSystemPrompt(systemPrompt, _useJsonMode) {
    return systemPrompt;
  },

  /**
   * Standard Bearer auth headers.
   * @param {string} apiKey
   * @returns {object}
   */
  getHeaders(apiKey) {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    };
  },

  /**
   * Send a chat completion request to OpenAI.
   * @param {object} opts
   * @param {string} opts.apiKey
   * @param {string} opts.model
   * @param {string} opts.systemPrompt
   * @param {string} opts.userPrompt
   * @param {number} opts.maxTokens
   * @param {boolean} [opts.useJsonMode=false]
   * @returns {Promise<{text: string|null, usage: object|null}>}
   */
  async chatCompletion({ apiKey, model, systemPrompt, userPrompt, maxTokens, useJsonMode = false }) {
    if (!apiKey) return { text: null, usage: null };

    return makeOpenAICompatibleRequest({
      endpoint: this.defaultEndpoint,
      headers: this.getHeaders(apiKey),
      model,
      systemPrompt: this.adjustSystemPrompt(systemPrompt, useJsonMode),
      userPrompt,
      maxTokens,
      useJsonMode,
      providerName: "OpenAI",
      // GPT-5.x / o-series reject "max_tokens" — OpenAI requires "max_completion_tokens".
      tokenParam: "max_completion_tokens"
    });
  }
};
