/**
 * Google Gemini image provider.
 * Supports Gemini native image generation models (gemini-*-image) via generateContent,
 * and Imagen 4 (imagen-4.0-*) via the predict endpoint.
 * API key is shared with the Gemini text provider (geminiApiKey).
 */

import { ensureFolder, saveImageLocally } from '../../utils/file-utils.js';

const DEFAULT_MODEL = "gemini-3.1-flash-image";
const BASE_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

// ─── Provider Definition ───

export const geminiImageProvider = {
  id: "gemini-image",
  name: "Google Gemini (Imagen)",
  requiresApiKey: true,

  /**
   * Generate an image using Google's Gemini image models or Imagen 4.
   * @param {string} prompt — final image prompt
   * @param {GeneratorConfig} config — module config with geminiApiKey, imageModel, imageFolder
   * @returns {Promise<string|null>} path to saved image file, or null on failure
   */
  async generateImage(prompt, config) {
    if (!config.geminiApiKey) {
      console.error("Gemini Image: no API key configured.");
      return null;
    }

    const model = config.imageModel || DEFAULT_MODEL;
    // Imagen 4 models use the predict endpoint; all others use generateContent
    const isImagen = model.startsWith("imagen-");

    let url, body;

    if (isImagen) {
      url = `${BASE_ENDPOINT}/models/${model}:predict?key=${config.geminiApiKey}`;
      body = {
        instances: [{ prompt }],
        parameters: { sampleCount: 1 }
      };
    } else {
      url = `${BASE_ENDPOINT}/models/${model}:generateContent?key=${config.geminiApiKey}`;
      body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] }
      };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        console.error(`Gemini image API error ${response.status}: ${errorBody}`);
        return null;
      }

      const data = await response.json();

      let b64, mimeType;

      if (isImagen) {
        const prediction = data.predictions?.[0];
        if (!prediction?.bytesBase64Encoded) {
          console.error("Gemini Imagen: no image data in response.", data);
          return null;
        }
        b64 = prediction.bytesBase64Encoded;
        mimeType = prediction.mimeType || "image/png";
      } else {
        // Find the inline image part in the generateContent response
        const parts = data.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith("image/"));
        if (!imagePart) {
          console.error("Gemini Image: no image part in response.", data);
          return null;
        }
        b64 = imagePart.inlineData.data;
        mimeType = imagePart.inlineData.mimeType;
      }

      const ext = mimeType === "image/jpeg" ? "jpg" : "png";
      const dataUrl = `data:${mimeType};base64,${b64}`;
      const shortName = prompt.replace(/[^a-zA-Z0-9 ]/g, "").split(/\s+/).slice(0, 4).join("_").toLowerCase();
      const fileName = `${shortName}_${Date.now()}.${ext}`;
      const targetFolder = config.imageFolder;
      await ensureFolder(targetFolder);

      return await saveImageLocally(dataUrl, fileName, targetFolder);
    } catch (err) {
      console.error("Gemini image request failed:", err.message);
      return null;
    }
  }
};
