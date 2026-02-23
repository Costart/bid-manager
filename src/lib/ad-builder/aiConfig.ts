export interface AIConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  ignoreLocations?: boolean;
}

export const DEFAULT_MODEL = "gpt-4o-mini";
export const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export async function saveAIConfigToServer(config: AIConfig): Promise<void> {
  const res = await fetch("/api/ai-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to save settings");
  }
}

export async function loadAIConfigFromServer(): Promise<AIConfig | null> {
  const res = await fetch("/api/ai-config");
  if (!res.ok) return null;
  const data = await res.json();
  return data.config || null;
}

export async function migrateLocalToServer(): Promise<AIConfig | null> {
  // No localStorage migration needed in this app
  return null;
}

export async function fetchModels(
  apiKey: string,
  baseUrl: string,
): Promise<string[]> {
  const url = baseUrl.replace(/\/$/, "") + "/models";
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  const data = await res.json();
  const models: string[] = (data.data || [])
    .map((m: any) => m.id as string)
    .sort((a: string, b: string) => a.localeCompare(b));
  return models;
}

export interface ProviderModel {
  id: string;
  label: string;
  recommended?: boolean;
}

export interface Provider {
  name: string;
  baseUrl: string;
  model: string;
  models: ProviderModel[];
  keyUrl: string;
  steps: string[];
}

export const PROVIDERS: Provider[] = [
  {
    name: "OpenAI",
    baseUrl: DEFAULT_BASE_URL,
    model: "gpt-4o-mini",
    models: [
      {
        id: "gpt-4o-mini",
        label: "GPT-4o Mini \u2014 Fast & cheap",
        recommended: true,
      },
      { id: "gpt-4o", label: "GPT-4o \u2014 Best quality" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 Mini \u2014 Latest mini" },
      { id: "gpt-4.1", label: "GPT-4.1 \u2014 Latest flagship" },
      { id: "o4-mini", label: "o4 Mini \u2014 Reasoning" },
    ],
    keyUrl: "https://platform.openai.com/api-keys",
    steps: [
      "Go to platform.openai.com and sign in",
      "Navigate to API Keys in the left sidebar",
      'Click "Create new secret key" and copy it',
    ],
  },
  {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
    models: [
      {
        id: "gemini-2.0-flash",
        label: "Gemini 2.0 Flash \u2014 Fast & free tier",
      },
      {
        id: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash \u2014 Fast & smart",
        recommended: true,
      },
      {
        id: "gemini-2.5-pro",
        label: "Gemini 2.5 Pro \u2014 Best quality",
      },
      {
        id: "gemini-3-flash-preview",
        label: "Gemini 3 Flash \u2014 Frontier (preview)",
      },
    ],
    keyUrl: "https://aistudio.google.com/apikey",
    steps: [
      "Go to aistudio.google.com and sign in with Google",
      'Click "Get API Key" in the top nav',
      "Create a key and copy it (free tier: 15 requests/min)",
    ],
  },
  {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    models: [
      {
        id: "deepseek-chat",
        label: "DeepSeek V3 \u2014 Best value",
        recommended: true,
      },
      { id: "deepseek-reasoner", label: "DeepSeek R1 \u2014 Reasoning" },
    ],
    keyUrl: "https://platform.deepseek.com/api_keys",
    steps: [
      "Go to platform.deepseek.com and create an account",
      "Navigate to API Keys",
      "Create a new key and copy it",
    ],
  },
  {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    models: [
      {
        id: "llama-3.3-70b-versatile",
        label: "Llama 3.3 70B \u2014 Best quality",
        recommended: true,
      },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B \u2014 Fastest" },
      { id: "gemma2-9b-it", label: "Gemma 2 9B \u2014 Lightweight" },
    ],
    keyUrl: "https://console.groq.com/keys",
    steps: [
      "Go to console.groq.com and sign in",
      "Navigate to API Keys",
      "Create a new key and copy it (generous free tier)",
    ],
  },
];
