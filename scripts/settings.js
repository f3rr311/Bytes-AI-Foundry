/**
 * Module settings registration for Bytes AI Foundry.
 */

export const MODULE_ID = "chatgpt-item-generator";

/** Default models per text provider, used for smart defaults on provider switch. */
export const PROVIDER_MODEL_DEFAULTS = {
  openai:    { chat: "gpt-5.5",              light: "gpt-5.4-mini" },
  anthropic: { chat: "claude-sonnet-4-6",    light: "claude-haiku-4-5" },
  gemini:    { chat: "gemini-3.5-flash",     light: "gemini-3.1-flash-lite" },
  xai:       { chat: "grok-4.3",             light: "grok-4.3" },
  ollama:    { chat: "llama3",               light: "llama3" },
  custom:    { chat: "",                     light: "" }
};

/** Default image model per image provider. Must cover every imageProvider choice. */
export const IMAGE_MODEL_DEFAULTS = {
  "openai":           "gpt-image-1",
  "xai":              "grok-imagine-image",
  "stable-diffusion": "",
  "stability-ai":     "stable-diffusion-xl-1024-v0-9",
  "fal-ai":           "fal-ai/flux/dev",
  "gemini-image":     "gemini-3.1-flash-image"
};

/**
 * Run one-time settings migration from older versions.
 * Called once during `ready` hook if _settingsVersion < current.
 */
/** Model IDs that are retired/invalid and should be reset to the provider default. */
const RETIRED_MODELS = new Set([
  // xAI — retired snapshots and a never-valid id shipped by an earlier dev build
  "grok-4-0709", "grok-4-1-fast-non-reasoning", "grok-4-1-fast", "grok-4.1-fast", "grok-3",
  // Anthropic — dated id retiring 2026-06-15
  "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001", "claude-opus-4-20250514"
]);

async function migrateSettings() {
  const currentVersion = 2;
  let stored = 0;
  try {
    stored = game.settings.get(MODULE_ID, "_settingsVersion");
  } catch { /* not registered yet on first run */ }
  if (stored >= currentVersion) return;

  // Migration 1: stableDiffusionEnabled boolean → imageProvider dropdown
  try {
    const sdEnabled = game.settings.get(MODULE_ID, "stableDiffusionEnabled");
    if (sdEnabled) {
      await game.settings.set(MODULE_ID, "imageProvider", "stable-diffusion");
    }
  } catch { /* setting may not exist yet */ }

  // Migration 2: reset retired/invalid text model IDs to the current provider's
  // default so saved settings from older versions (or early dev builds) don't 404.
  try {
    const provider = game.settings.get(MODULE_ID, "textProvider");
    const defaults = PROVIDER_MODEL_DEFAULTS[provider];
    if (defaults) {
      if (RETIRED_MODELS.has(game.settings.get(MODULE_ID, "chatModel"))) {
        await game.settings.set(MODULE_ID, "chatModel", defaults.chat);
      }
      if (RETIRED_MODELS.has(game.settings.get(MODULE_ID, "lightModel"))) {
        await game.settings.set(MODULE_ID, "lightModel", defaults.light);
      }
    }
  } catch { /* settings may not exist yet */ }

  await game.settings.set(MODULE_ID, "_settingsVersion", currentVersion);
}

/**
 * Apply smart defaults when a provider changes.
 * Called on every `ready` hook — separate from one-time migration.
 */
async function applyProviderDefaults() {
  // Text provider → chatModel / lightModel
  try {
    const currentText = game.settings.get(MODULE_ID, "textProvider");
    const lastText = game.settings.get(MODULE_ID, "_lastTextProvider");
    if (currentText !== lastText) {
      const defaults = PROVIDER_MODEL_DEFAULTS[currentText];
      if (defaults) {
        await game.settings.set(MODULE_ID, "chatModel", defaults.chat);
        await game.settings.set(MODULE_ID, "lightModel", defaults.light);
      }
      await game.settings.set(MODULE_ID, "_lastTextProvider", currentText);
    }
  } catch { /* settings may not exist on first run */ }

  // Image provider → imageModel
  try {
    const currentImage = game.settings.get(MODULE_ID, "imageProvider");
    const lastImage = game.settings.get(MODULE_ID, "_lastImageProvider");
    if (currentImage !== lastImage) {
      const defaultModel = IMAGE_MODEL_DEFAULTS[currentImage];
      if (defaultModel !== undefined) {
        await game.settings.set(MODULE_ID, "imageModel", defaultModel);
      }
      await game.settings.set(MODULE_ID, "_lastImageProvider", currentImage);
    }
  } catch { /* settings may not exist on first run */ }
}

export function registerSettings() {
  // ─── Internal version tracking (hidden) ───
  game.settings.register(MODULE_ID, "_settingsVersion", {
    scope: "world", config: false, type: Number, default: 0
  });
  game.settings.register(MODULE_ID, "_lastTextProvider", {
    scope: "world", config: false, type: String, default: "openai"
  });
  game.settings.register(MODULE_ID, "_lastImageProvider", {
    scope: "world", config: false, type: String, default: "openai"
  });

  // ─── Text Provider Selection ───
  game.settings.register(MODULE_ID, "textProvider", {
    name: "Text AI Provider",
    hint: "Select which AI service to use for text generation.\n* Changing the provider auto-updates the Primary and Lightweight model fields (reopen settings to see the new values).",
    scope: "world",
    config: true,
    type: String,
    default: "openai",
    choices: {
      "openai":    "OpenAI",
      "anthropic": "Anthropic Claude",
      "gemini":    "Google Gemini",
      "xai":       "xAI Grok",
      "ollama":    "Ollama (Local)",
      "custom":    "Custom (OpenAI-Compatible)"
    },
    group: MODULE_ID + ".text-provider",
    onChange: async (value) => {
      // The settings form fills the model fields live on provider change (see the
      // renderSettingsConfig hook), so the saved field values are authoritative.
      // Just record the provider so applyProviderDefaults() won't later overwrite
      // a model the user customized. No page reload (avoids the save race).
      await game.settings.set(MODULE_ID, "_lastTextProvider", value);
    }
  });

  // ─── API Keys (per provider) ───
  game.settings.register(MODULE_ID, "openaiApiKey", {
    name: "OpenAI API Key",
    hint: "Your OpenAI API key for text generation. Required when Text AI Provider is set to OpenAI.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    group: MODULE_ID + ".text-provider"
  });
  game.settings.register(MODULE_ID, "anthropicApiKey", {
    name: "Anthropic API Key",
    hint: "Your Anthropic API key for Claude models. Required when Text AI Provider is set to Anthropic Claude.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    group: MODULE_ID + ".text-provider"
  });
  game.settings.register(MODULE_ID, "geminiApiKey", {
    name: "Google Gemini API Key",
    hint: "Your Google AI API key for Gemini models. Get one at ai.google.dev. Required when Text AI Provider is set to Google Gemini.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    group: MODULE_ID + ".text-provider"
  });
  game.settings.register(MODULE_ID, "xaiApiKey", {
    name: "xAI API Key",
    hint: "Your xAI API key for Grok models. Required when Text AI Provider is set to xAI Grok. Also used for xAI image generation.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    group: MODULE_ID + ".text-provider"
  });
  game.settings.register(MODULE_ID, "customApiKey", {
    name: "Custom Provider API Key",
    hint: "API key for your custom OpenAI-compatible endpoint (if required).",
    scope: "world",
    config: true,
    type: String,
    default: "",
    group: MODULE_ID + ".text-provider"
  });
  game.settings.register(MODULE_ID, "customEndpoint", {
    name: "Custom Provider Endpoint",
    hint: "Full URL to an OpenAI-compatible chat completions endpoint (e.g. https://my-server.com/v1/chat/completions).",
    scope: "world",
    config: true,
    type: String,
    default: "",
    group: MODULE_ID + ".text-provider"
  });
  game.settings.register(MODULE_ID, "ollamaEndpoint", {
    name: "Ollama Endpoint",
    hint: "Base URL for your local Ollama instance (default: http://localhost:11434).",
    scope: "world",
    config: true,
    type: String,
    default: "http://localhost:11434",
    group: MODULE_ID + ".text-provider"
  });

  // ─── Model Selection ───
  game.settings.register(MODULE_ID, "chatModel", {
    name: "Primary Model (Item JSON & Roll Tables)",
    hint: "* Auto-set when you switch Text AI Provider. You can override with any model your provider supports. Examples — OpenAI: gpt-5.5. Claude: claude-sonnet-4-6. Gemini: gemini-3.5-flash. xAI: grok-4.3. Ollama: your installed model name.",
    scope: "world",
    config: true,
    type: String,
    default: "gpt-5.5",
    group: MODULE_ID + ".text-models"
  });
  game.settings.register(MODULE_ID, "lightModel", {
    name: "Lightweight Model (Names, Fixes, Properties)",
    hint: "* Auto-set when you switch Text AI Provider. You can override with any model your provider supports. Examples — OpenAI: gpt-5.4-mini. Claude: claude-haiku-4-5. Gemini: gemini-3.1-flash-lite. xAI: grok-4.3. Ollama: your installed model name.",
    scope: "world",
    config: true,
    type: String,
    default: "gpt-5.4-mini",
    group: MODULE_ID + ".text-models"
  });

  // ─── Image Provider Selection ───
  game.settings.register(MODULE_ID, "imageProvider", {
    name: "Image AI Provider",
    hint: "Select which AI service to use for image generation.\n* Changing the provider auto-updates the Image Generation Model field (reopen settings to see the new value).",
    scope: "world",
    config: true,
    type: String,
    default: "openai",
    choices: {
      "openai":            "OpenAI (GPT Image 1 / DALL-E)",
      "xai":               "xAI Grok (Grok Imagine)",
      "stable-diffusion":  "Stable Diffusion (Local)",
      "stability-ai":      "Stability AI",
      "fal-ai":            "FAL.ai (FLUX, Recraft, Ideogram)",
      "gemini-image":      "Google Gemini (Imagen)"
    },
    group: MODULE_ID + ".image-provider",
    onChange: async (value) => {
      // The settings form fills the image-model field live on provider change
      // (see the renderSettingsConfig hook), so the saved field value is
      // authoritative. Just record the provider so applyProviderDefaults() won't
      // later overwrite a model the user customized. No page reload.
      await game.settings.set(MODULE_ID, "_lastImageProvider", value);
    }
  });
  game.settings.register(MODULE_ID, "dalleApiKey", {
    name: "OpenAI Image API Key",
    hint: "Your OpenAI API key for image generation (GPT Image 1 / DALL-E). Can be the same as your text API key.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    group: MODULE_ID + ".image-provider"
  });
  game.settings.register(MODULE_ID, "stabilityApiKey", {
    name: "Stability AI API Key",
    hint: "Your Stability AI API key for image generation. Required when Image AI Provider is set to Stability AI.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    group: MODULE_ID + ".image-provider"
  });
  game.settings.register(MODULE_ID, "falApiKey", {
    name: "FAL.ai API Key",
    hint: "Your FAL.ai API key for image generation (FLUX, Recraft, Ideogram models). Required when Image AI Provider is set to FAL.ai.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    group: MODULE_ID + ".image-provider"
  });

  // ─── Image Model & Format ───
  game.settings.register(MODULE_ID, "imageModel", {
    name: "Image Generation Model",
    hint: "* Auto-set when you switch Image AI Provider. You can override with any model your provider supports. Examples — OpenAI: gpt-image-1, dall-e-3. Stability AI: stable-image-core. FAL.ai: fal-ai/flux/dev, fal-ai/recraft-v3. Gemini (generateContent): gemini-3.1-flash-image (default), gemini-2.5-flash-image, gemini-3-pro-image. Gemini (Imagen 4, predict): imagen-4.0-generate-001, imagen-4.0-fast-generate-001.",
    scope: "world",
    config: true,
    type: String,
    default: "gpt-image-1",
    group: MODULE_ID + ".image-settings"
  });
  game.settings.register(MODULE_ID, "imageFormat", {
    name: "Image Output Format",
    hint: "Format for generated images. PNG is lossless, WebP is smaller, JPEG is smallest.",
    scope: "world",
    config: true,
    type: String,
    default: "png",
    choices: {
      "png": "PNG (Lossless)",
      "webp": "WebP (Smaller)",
      "jpeg": "JPEG (Smallest)"
    },
    group: MODULE_ID + ".image-settings"
  });

  // ─── Stable Diffusion Settings ───
  game.settings.register(MODULE_ID, "stableDiffusionEnabled", {
    name: "Use Stable Diffusion for Image Generation (Legacy)",
    hint: "Legacy setting — use the Image AI Provider dropdown above instead. Kept for migration.",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, "stableDiffusionAPIKey", {
    name: "Stable Diffusion API Key",
    hint: "Enter your Stable Diffusion API key (if required) for generating images.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    group: MODULE_ID + ".stable-diffusion"
  });
  game.settings.register(MODULE_ID, "stableDiffusionEndpoint", {
    name: "Stable Diffusion API Endpoint",
    hint: "Enter the endpoint URL for your Stable Diffusion image generation service.",
    scope: "world",
    config: true,
    type: String,
    default: "http://127.0.0.1:7860/sd-queue/txt2img",
    group: MODULE_ID + ".stable-diffusion"
  });
  game.settings.register(MODULE_ID, "sdMainPrompt", {
    name: "Stable Diffusion Main Prompt",
    hint: "Base prompt for image generation. Use {prompt} as a placeholder for dynamic item details.",
    scope: "world",
    config: true,
    type: String,
    default: "Refined, highly detailed, fantasy concept art for a DnD 5e item with these details: {prompt}. Do not include any text in the image.",
    group: MODULE_ID + ".stable-diffusion"
  });
  game.settings.register(MODULE_ID, "sdNegativePrompt", {
    name: "Stable Diffusion Negative Prompt",
    hint: "Terms to exclude from the generated image.",
    scope: "world",
    config: true,
    type: String,
    default: "rough sketch, blurry, cartoonish, text, watermark, signature, low detail",
    group: MODULE_ID + ".stable-diffusion"
  });
  game.settings.register(MODULE_ID, "sdSteps", {
    name: "Stable Diffusion Steps",
    hint: "Number of steps to generate the image. Higher values may increase generation time.",
    scope: "world",
    config: true,
    type: Number,
    default: 70,
    group: MODULE_ID + ".stable-diffusion"
  });
  game.settings.register(MODULE_ID, "sdCfgScale", {
    name: "Stable Diffusion CFG Scale",
    hint: "Controls how strongly the model follows the prompt.",
    scope: "world",
    config: true,
    type: Number,
    default: 9.0,
    group: MODULE_ID + ".stable-diffusion"
  });
  game.settings.register(MODULE_ID, "sdSamplerName", {
    name: "Stable Diffusion Sampler Name",
    hint: "Name of the sampler to use. Ensure this matches one available on your Stable Diffusion instance.",
    scope: "world",
    config: true,
    type: String,
    default: "Euler",
    group: MODULE_ID + ".stable-diffusion"
  });

  // ─── Customizable Prompts ───
  game.settings.register(MODULE_ID, "chatgptJSONPrompt", {
    name: "Item JSON Prompt (Editable Portion)",
    hint: "Additional instructions appended to the item JSON generation prompt. The core JSON formatting is fixed.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    group: MODULE_ID + ".prompts"
  });
  game.settings.register(MODULE_ID, "chatgptRollTablePrompt", {
    name: "Roll Table JSON Prompt (Editable Portion)",
    hint: "Additional instructions appended to the roll table generation prompt.",
    scope: "world",
    config: true,
    type: String,
    default: "You are an expert in fantasy RPGs. Generate distinctive, evocative item names for the roll table",
    group: MODULE_ID + ".prompts"
  });
  game.settings.register(MODULE_ID, "chatgptFixMismatchPrompt", {
    name: "Fix Mismatch Prompt (Editable Portion)",
    hint: "Additional instructions for fixing JSON mismatches.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    group: MODULE_ID + ".prompts"
  });
  game.settings.register(MODULE_ID, "chatgptNamePrompt", {
    name: "Item Name Prompt (Editable Portion)",
    hint: "Additional instructions for generating item names. The fixed instruction 'Do not output JSON.' is enforced.",
    scope: "world",
    config: true,
    type: String,
    default: "You are an expert in fantasy RPGs. Do not include the word 'dragon' unless explicitly requested.",
    group: MODULE_ID + ".prompts"
  });
  game.settings.register(MODULE_ID, "dallePrompt", {
    name: "Image Prompt",
    hint: "Template sent to the image model. {prompt} is replaced with the item's name + description. Everything else is the art style. Applies to every image provider (OpenAI, xAI, Stability, FAL, Gemini).",
    scope: "world",
    config: true,
    type: String,
    default: "A dramatic dark-fantasy illustration of a single DnD 5e item: {prompt}. Rendered in a moody, atmospheric style with deep shadows, rich dark tones, and warm magical highlights or glowing enchantment effects. Highly detailed textures on metal, leather, gemstones, and magical auras. The item is the sole focus, displayed against a dark, shadowy background with subtle ambient lighting. Style of a dark fantasy collectible card or high-end RPG game asset. No text, no letters, no words, no labels, no writing anywhere in the image.",
    group: MODULE_ID + ".prompts"
  });

  // ─── Actor Generation Prompts ───
  game.settings.register(MODULE_ID, "actorNPCPrompt", {
    name: "NPC Generation Prompt (Extra Instructions)",
    hint: "Additional instructions appended to the NPC generation prompt. Leave blank for defaults.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    group: MODULE_ID + ".prompts"
  });
  game.settings.register(MODULE_ID, "actorCharacterPrompt", {
    name: "Character Generation Prompt (Extra Instructions)",
    hint: "Additional instructions appended to the character generation prompt. Leave blank for defaults.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    group: MODULE_ID + ".prompts"
  });
  game.settings.register(MODULE_ID, "actorPortraitPrompt", {
    name: "Actor Portrait Image Prompt",
    hint: "Template for the actor's portrait. {prompt} is replaced with the actor's description; the rest sets the art style.",
    scope: "world",
    config: true,
    type: String,
    default: "A portrait of {prompt}. Dark fantasy RPG character portrait. Detailed face and upper body, dramatic lighting, rich dark tones. Painterly style, moody and atmospheric. No text, no letters, no words.",
    group: MODULE_ID + ".prompts"
  });
  game.settings.register(MODULE_ID, "actorTokenPrompt", {
    name: "Actor Token Image Prompt",
    hint: "Template for the actor's token. {prompt} is replaced with the actor's description; the rest sets the art style.",
    scope: "world",
    config: true,
    type: String,
    default: "A top-down RPG battle map token of {prompt}. Circular token, dark background, dramatic lighting. Detailed miniature style. No text, no letters, no words.",
    group: MODULE_ID + ".prompts"
  });
}

/** Run settings migration and provider defaults. Call from the `ready` hook. */
export { migrateSettings, applyProviderDefaults };
