/**
 * Bytes AI Foundry — Entry point.
 * Registers settings, builds config, hooks into Foundry, and delegates to UI dialogs.
 */

import {
  registerSettings, migrateSettings, applyProviderDefaults, MODULE_ID,
  PROVIDER_MODEL_DEFAULTS, IMAGE_MODEL_DEFAULTS
} from './settings.js';
import { openGenerateDialog } from './ui/generate-dialog.js';
import { openHistoryDialog } from './ui/history-dialog.js';
import { openActorDialog } from './ui/actor-dialog.js';
import { NAME_KEYWORDS } from './utils/type-keywords.js';

// ---------- Config Builder ----------

/**
 * @typedef {Object} GeneratorConfig
 * @property {string} apiKey — OpenAI API key for chat completions
 * @property {string} dalleApiKey — OpenAI API key for image generation
 * @property {string} chatModel — Primary model name (provider-specific)
 * @property {string} lightModel — Lightweight model name for fixes/names
 * @property {string} imageModel — Image generation model
 * @property {string} imageFormat — Output format: "png", "webp", or "jpeg"
 * @property {string[]} keywords — Item keyword list for name forcing
 * @property {string} imageFolder — Foundry data folder for generated images
 * @property {boolean} isDnd5eV4 — true if dnd5e system version >= 4.0.0
 * @property {string|null} dnd5eVersion — dnd5e system version string, or null
 * @property {boolean} isV13Core — true if Foundry core version >= 13
 * @property {string} textProvider — "openai"|"anthropic"|"gemini"|"xai"|"ollama"|"custom"
 * @property {string} imageProvider — "openai"|"stable-diffusion"|"stability-ai"|"fal-ai"
 * @property {string} anthropicApiKey — Anthropic API key
 * @property {string} geminiApiKey — Google Gemini API key
 * @property {string} xaiApiKey — xAI API key
 * @property {string} customApiKey — Custom provider API key
 * @property {string} customEndpoint — Custom provider endpoint URL
 * @property {string} ollamaEndpoint — Ollama base URL
 * @property {string} stabilityApiKey — Stability AI API key
 * @property {string} falApiKey — FAL.ai API key
 */

function buildConfig() {
  const isDnd5e = game.system.id === "dnd5e";
  const sysVer = isDnd5e ? game.system.version : "0.0.0";
  return {
    // Existing fields (unchanged)
    apiKey: game.settings.get(MODULE_ID, "openaiApiKey") || "",
    dalleApiKey: game.settings.get(MODULE_ID, "dalleApiKey") || "",
    chatModel: game.settings.get(MODULE_ID, "chatModel") || "gpt-5.5",
    lightModel: game.settings.get(MODULE_ID, "lightModel") || "gpt-5.4-mini",
    imageModel: game.settings.get(MODULE_ID, "imageModel") || "gpt-image-1",
    imageFormat: game.settings.get(MODULE_ID, "imageFormat") || "png",
    keywords: NAME_KEYWORDS,
    imageFolder: MODULE_ID,
    isDnd5eV4: isDnd5e && !foundry.utils.isNewerVersion("4.0.0", sysVer),
    dnd5eVersion: isDnd5e ? sysVer : null,
    isV13Core: game.release.generation >= 13,

    // Provider selection
    textProvider: game.settings.get(MODULE_ID, "textProvider") || "openai",
    imageProvider: game.settings.get(MODULE_ID, "imageProvider") || "openai",

    // Per-provider API keys
    anthropicApiKey: game.settings.get(MODULE_ID, "anthropicApiKey") || "",
    geminiApiKey: game.settings.get(MODULE_ID, "geminiApiKey") || "",
    xaiApiKey: game.settings.get(MODULE_ID, "xaiApiKey") || "",
    customApiKey: game.settings.get(MODULE_ID, "customApiKey") || "",
    customEndpoint: game.settings.get(MODULE_ID, "customEndpoint") || "",
    ollamaEndpoint: game.settings.get(MODULE_ID, "ollamaEndpoint") || "http://localhost:11434",

    // Image provider keys
    stabilityApiKey: game.settings.get(MODULE_ID, "stabilityApiKey") || "",
    falApiKey: game.settings.get(MODULE_ID, "falApiKey") || ""
  };
}

// ---------- Dialog Wiring ----------

// Mutually recursive: generate <-> history dialogs reference each other.
// We pass buildConfig and the counterpart opener as callbacks to break the cycle.

function showGenerateDialog() {
  if (!game.user.isGM) {
    ui.notifications.warn("Only the GM can use the item generator.");
    return;
  }
  openGenerateDialog(buildConfig, showHistoryDialog);
}

function showHistoryDialog() {
  openHistoryDialog(buildConfig, showGenerateDialog);
}

function showActorDialog() {
  if (!game.user.isGM) {
    ui.notifications.warn("Only the GM can use the actor generator.");
    return;
  }
  openActorDialog(buildConfig, showHistoryDialog);
}

// ---------- Hooks ----------

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", async () => {
  // Run one-time settings migration, then apply provider defaults
  await migrateSettings();
  await applyProviderDefaults();

  // Expose a lightweight API object on game for backward compat
  game.chatGPTItemGenerator = {
    createFoundryAIObject: showGenerateDialog,
    openGenerateDialog: showGenerateDialog,
    openActorDialog: showActorDialog,
    sessionCost: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      apiCalls: 0,
      imageGenerations: 0
    },
    currentCost: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      apiCalls: 0,
      imageGenerations: 0
    },
    history: []
  };

  // Warn about deprecated image models
  const imageModel = game.settings.get(MODULE_ID, "imageModel");
  if (imageModel.startsWith("dall-e")) {
    ui.notifications.warn(
      `Bytes AI Foundry: You are using ${imageModel}, which is deprecated and will stop working after May 12, 2026. Please switch to "GPT Image 1" in module settings.`,
      { permanent: true }
    );
  }

  const moduleVersion = game.modules.get(MODULE_ID)?.version ?? "unknown";
  console.log(`Bytes AI Foundry v${moduleVersion} loaded`);
});

/**
 * Insert a subtitle + a high-contrast help note after the module's settings
 * heading. Additive and idempotent — does nothing if the anchor isn't found,
 * and skips re-injection when the form re-renders.
 * @param {HTMLElement} anchor — the module's <h2> heading element
 */
function injectModuleSettingsHelp(anchor) {
  if (!anchor || anchor.nextElementSibling?.dataset?.bytesaiHelp) return;
  const wrap = document.createElement("div");
  wrap.dataset.bytesaiHelp = "1";
  wrap.style.cssText = "margin: -4px 0 10px 0;";
  wrap.innerHTML =
    `<p style="margin:0 0 5px 0; font-size:12px; color:#aaa; font-style:italic;">` +
    `Multi-provider AI item, NPC, character, and roll table generator for D&amp;D 5e</p>` +
    `<p style="margin:0; font-size:12px; color:#cfc8f2; line-height:1.45;">` +
    `<b style="color:#dcd6ff;">Tips:</b> In any prompt field, ` +
    `<code style="background:rgba(124,92,252,0.18); padding:0 4px; border-radius:3px; color:#e6e1ff;">{prompt}</code>` +
    ` is replaced with the generated item's <b>name and description</b>. ` +
    `When you change a <b>provider</b>, the matching <b>model</b> field auto-fills with that provider's default. ` +
    `Text and image generation use <b>separate</b> API keys.</p>`;
  anchor.after(wrap);
}

// Inject subtitle + help below the module title in Settings
Hooks.on("renderSettingsConfig", (app, html) => {
  const root = html instanceof jQuery ? html[0] : html;
  let header = root.querySelector(`[data-category="${MODULE_ID}"] h2, h2.module-header[data-module-id="${MODULE_ID}"]`);
  if (!header) {
    // v13/v14 group-based layout — find our module heading by text content
    for (const h of root.querySelectorAll("h2")) {
      if (h.textContent.trim() === "Bytes AI Foundry") { header = h; break; }
    }
  }
  injectModuleSettingsHelp(header);

  // Live smart-default: when the provider dropdown changes, fill the model
  // field(s) immediately so the user sees the new default without reopening
  // settings. The field stays editable; whatever it shows is what gets saved.
  const field = (key) => root.querySelector(`[name="${MODULE_ID}.${key}"]`);
  const textProvider = field("textProvider");
  const chatModel = field("chatModel");
  const lightModel = field("lightModel");
  if (textProvider && chatModel && lightModel) {
    textProvider.addEventListener("change", (e) => {
      const defaults = PROVIDER_MODEL_DEFAULTS[e.target.value];
      if (defaults) {
        chatModel.value = defaults.chat;
        lightModel.value = defaults.light;
      }
    });
  }
  const imageProvider = field("imageProvider");
  const imageModel = field("imageModel");
  if (imageProvider && imageModel) {
    imageProvider.addEventListener("change", (e) => {
      const model = IMAGE_MODEL_DEFAULTS[e.target.value];
      if (model !== undefined) imageModel.value = model;
    });
  }
});

Hooks.on("renderItemDirectory", (app, html, data) => {
  if (!game.user.isGM) return;

  // v13 passes a native element, v12 passes jQuery
  if (game.release.generation < 13) {
    const button = $("<button><i class='fas fa-magic'></i> Generate AI (Item or RollTable)</button>");
    html.find(".directory-footer").append(button);
    button.click(() => showGenerateDialog());
  } else {
    const buttonHTML = `<button><i class='fas fa-magic'></i> Generate AI (Item or RollTable)</button>`;
    html.querySelector(".directory-footer").insertAdjacentHTML('beforeend', buttonHTML);
    html.querySelector(".directory-footer button:last-child").addEventListener("click", () => showGenerateDialog());
  }
});

Hooks.on("renderActorDirectory", (app, html, data) => {
  if (!game.user.isGM) return;

  if (game.release.generation < 13) {
    const button = $("<button><i class='fas fa-users'></i> Generate AI (NPC or Character)</button>");
    html.find(".directory-footer").append(button);
    button.click(() => showActorDialog());
  } else {
    const buttonHTML = `<button><i class='fas fa-users'></i> Generate AI (NPC or Character)</button>`;
    html.querySelector(".directory-footer").insertAdjacentHTML('beforeend', buttonHTML);
    html.querySelector(".directory-footer button:last-child").addEventListener("click", () => showActorDialog());
  }
});
