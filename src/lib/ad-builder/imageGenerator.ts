import { AIConfig } from "./aiConfig";

interface GeneratedImage {
  base64: string;
  mimeType: string;
}

function isGeminiProvider(baseUrl: string): boolean {
  return baseUrl.includes("generativelanguage.googleapis.com");
}

function isOpenAIProvider(baseUrl: string): boolean {
  return baseUrl.includes("api.openai.com");
}

async function generateImageGemini(
  apiKey: string,
  prompt: string,
  aspectRatio: "1:1" | "16:9",
): Promise<GeneratedImage> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio,
        },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini image generation failed: ${text}`);
  }

  const data = await res.json();
  const prediction = data.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error("No image data in Gemini response");
  }

  return {
    base64: prediction.bytesBase64Encoded,
    mimeType: prediction.mimeType || "image/png",
  };
}

async function generateImageOpenAI(
  apiKey: string,
  prompt: string,
  size: "1024x1024" | "1792x1024",
): Promise<GeneratedImage> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      response_format: "b64_json",
      quality: "standard",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI image generation failed: ${text}`);
  }

  const data = await res.json();
  const imageData = data.data?.[0]?.b64_json;
  if (!imageData) {
    throw new Error("No image data in OpenAI response");
  }

  return {
    base64: imageData,
    mimeType: "image/png",
  };
}

function resizeImageOnCanvas(
  base64: string,
  mimeType: string,
  targetWidth: number,
  targetHeight: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d")!;

      // Cover crop: fill the target dimensions
      const srcRatio = img.width / img.height;
      const tgtRatio = targetWidth / targetHeight;

      let sx = 0,
        sy = 0,
        sw = img.width,
        sh = img.height;

      if (srcRatio > tgtRatio) {
        // Source is wider — crop sides
        sw = img.height * tgtRatio;
        sx = (img.width - sw) / 2;
      } else {
        // Source is taller — crop top/bottom
        sh = img.width / tgtRatio;
        sy = (img.height - sh) / 2;
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

      const jpegBase64 = canvas
        .toDataURL("image/jpeg", 0.9)
        .replace(/^data:image\/jpeg;base64,/, "");
      resolve(jpegBase64);
    };
    img.onerror = () => reject(new Error("Failed to load image for resize"));
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

async function uploadToR2(
  base64: string,
  key: string,
  contentType: string,
): Promise<string> {
  const res = await fetch("/api/images/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, key, contentType }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Image upload failed");
  }
  const data = await res.json();
  return data.key;
}

export async function generateImagePrompt(
  config: AIConfig,
  pageContext: string,
  language?: string,
): Promise<string> {
  const url = config.baseUrl.replace(/\/$/, "") + "/chat/completions";

  const langRule = language
    ? `\n- The image should feel culturally appropriate for ${language}-speaking audiences.`
    : "";

  const prompt = `You are a Google Ads image prompt specialist.
Page Context: ${pageContext}

Write a concise image generation prompt for a professional marketing image that represents this page's product or service.

Rules:
- NO text, words, letters, numbers, logos, or watermarks in the image
- Photorealistic, high quality, clean and modern aesthetic
- Must visually represent the core product/service
- Suitable as a Google Ads image extension
- Describe the scene, objects, colors, lighting, composition
- Keep the prompt under 200 words${langRule}

Respond with JSON:
{ "prompt": "your image generation prompt here" }`;

  const body: Record<string, unknown> = {
    model: config.model,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image prompt generation failed: ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response for image prompt");

  const parsed = JSON.parse(
    content
      .replace(/^```json\s*/, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, ""),
  );

  return parsed.prompt;
}

export async function generateAdGroupImages(
  config: AIConfig,
  imagePrompt: string,
  adGroupId: string,
): Promise<{ landscape?: string; square?: string }> {
  const images: { landscape?: string; square?: string } = {};

  const isGemini = isGeminiProvider(config.baseUrl);
  const isOpenAI = isOpenAIProvider(config.baseUrl);

  if (!isGemini && !isOpenAI) {
    // Unsupported provider for image generation — try Gemini-style anyway
    // since user might be on a Gemini-compatible endpoint
    try {
      return await generateWithGemini(config.apiKey, imagePrompt, adGroupId);
    } catch {
      console.warn("Image generation not supported for this provider");
      return images;
    }
  }

  if (isGemini) {
    return await generateWithGemini(config.apiKey, imagePrompt, adGroupId);
  }

  if (isOpenAI) {
    return await generateWithOpenAI(config.apiKey, imagePrompt, adGroupId);
  }

  return images;
}

async function generateWithGemini(
  apiKey: string,
  prompt: string,
  adGroupId: string,
): Promise<{ landscape?: string; square?: string }> {
  const images: { landscape?: string; square?: string } = {};

  // Generate landscape (16:9 → resize to 1200x628)
  try {
    const landscape = await generateImageGemini(apiKey, prompt, "16:9");
    const resized = await resizeImageOnCanvas(
      landscape.base64,
      landscape.mimeType,
      1200,
      628,
    );
    const key = `${adGroupId}-landscape.jpg`;
    await uploadToR2(resized, key, "image/jpeg");
    images.landscape = key;
  } catch (e) {
    console.warn("Landscape image generation failed:", e);
  }

  // Generate square (1:1 → resize to 1200x1200)
  try {
    const square = await generateImageGemini(apiKey, prompt, "1:1");
    const resized = await resizeImageOnCanvas(
      square.base64,
      square.mimeType,
      1200,
      1200,
    );
    const key = `${adGroupId}-square.jpg`;
    await uploadToR2(resized, key, "image/jpeg");
    images.square = key;
  } catch (e) {
    console.warn("Square image generation failed:", e);
  }

  return images;
}

async function generateWithOpenAI(
  apiKey: string,
  prompt: string,
  adGroupId: string,
): Promise<{ landscape?: string; square?: string }> {
  const images: { landscape?: string; square?: string } = {};

  // Generate landscape (1792x1024 → resize to 1200x628)
  try {
    const landscape = await generateImageOpenAI(apiKey, prompt, "1792x1024");
    const resized = await resizeImageOnCanvas(
      landscape.base64,
      landscape.mimeType,
      1200,
      628,
    );
    const key = `${adGroupId}-landscape.jpg`;
    await uploadToR2(resized, key, "image/jpeg");
    images.landscape = key;
  } catch (e) {
    console.warn("Landscape image generation failed:", e);
  }

  // Generate square (1024x1024 → resize to 1200x1200)
  try {
    const square = await generateImageOpenAI(apiKey, prompt, "1024x1024");
    const resized = await resizeImageOnCanvas(
      square.base64,
      square.mimeType,
      1200,
      1200,
    );
    const key = `${adGroupId}-square.jpg`;
    await uploadToR2(resized, key, "image/jpeg");
    images.square = key;
  } catch (e) {
    console.warn("Square image generation failed:", e);
  }

  return images;
}
