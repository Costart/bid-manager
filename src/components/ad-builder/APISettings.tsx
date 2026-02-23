"use client";

import React, { useState, useCallback } from "react";
import {
  AIConfig,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  PROVIDERS,
  Provider,
  saveAIConfigToServer,
  fetchModels,
} from "@/lib/ad-builder/aiConfig";
import {
  Key,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Check,
  Pencil,
  Cpu,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface APISettingsProps {
  config: AIConfig | null;
  onSave: (config: AIConfig) => void;
}

export default function APISettings({ config, onSave }: APISettingsProps) {
  const [editing, setEditing] = useState(!config);
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "");
  const [model, setModel] = useState(config?.model ?? DEFAULT_MODEL);
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? DEFAULT_BASE_URL);
  const [showKey, setShowKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(
    config?.baseUrl ? config.baseUrl !== DEFAULT_BASE_URL : false,
  );
  const [showGuide, setShowGuide] = useState(!config);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [ignoreLocations, setIgnoreLocations] = useState(
    config?.ignoreLocations ?? false,
  );
  const [liveModels, setLiveModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsFetched, setModelsFetched] = useState(false);

  const loadModels = useCallback(async (key: string, url: string) => {
    if (!key.trim()) return;
    setModelsLoading(true);
    try {
      const models = await fetchModels(
        key.trim(),
        url.trim() || DEFAULT_BASE_URL,
      );
      setLiveModels(models);
      setModelsFetched(true);
    } catch {
      setLiveModels([]);
      setModelsFetched(false);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    const newConfig: AIConfig = {
      apiKey: apiKey.trim(),
      model: model.trim() || DEFAULT_MODEL,
      baseUrl: baseUrl.trim() || DEFAULT_BASE_URL,
      ignoreLocations,
    };

    setSaving(true);
    setSaveError(null);
    try {
      await saveAIConfigToServer(newConfig);
      onSave(newConfig);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const selectProvider = (provider: Provider) => {
    setBaseUrl(provider.baseUrl);
    setModel(provider.model);
    setLiveModels([]);
    setModelsFetched(false);
    if (provider.baseUrl !== DEFAULT_BASE_URL) {
      setShowAdvanced(true);
    }
    if (apiKey.trim()) {
      loadModels(apiKey, provider.baseUrl);
    }
  };

  const activeProvider = PROVIDERS.find((p) => baseUrl === p.baseUrl) ?? null;
  const providerName =
    PROVIDERS.find((p) => config?.baseUrl === p.baseUrl)?.name ?? "Custom";

  if (!editing && config) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
            {saved ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Cpu className="w-4 h-4 text-emerald-600" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              {providerName}
              <span className="text-slate-300 font-normal">/</span>
              <code className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded truncate">
                {config.model}
              </code>
            </div>
            <p className="text-xs text-slate-400 truncate">
              API key configured
              {config.baseUrl !== DEFAULT_BASE_URL && (
                <> &middot; {config.baseUrl}</>
              )}
              {config.ignoreLocations && (
                <> &middot; Ignoring locations</>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">AI Provider</h3>
            <p className="text-xs text-slate-400">
              Your key stays in your browser
            </p>
          </div>
        </div>
        {config && (
          <button
            onClick={() => setEditing(false)}
            className="text-xs font-medium text-slate-400 hover:text-slate-600 transition"
          >
            Cancel
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="px-6 pb-6 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            API Key <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Key className="w-3.5 h-3.5" />
            </div>
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              required
              className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
            >
              {showKey ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-slate-600">
              Model
            </label>
            {apiKey.trim() && (
              <button
                type="button"
                onClick={() => loadModels(apiKey, baseUrl)}
                disabled={modelsLoading}
                className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 disabled:text-slate-400 transition"
              >
                {modelsLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                {modelsFetched ? "Refresh" : "Load models"}
              </button>
            )}
          </div>
          {modelsFetched && liveModels.length > 0 ? (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition appearance-none pr-10"
            >
              {liveModels.map((id) => {
                const known = activeProvider?.models.find((m) => m.id === id);
                return (
                  <option key={id} value={id}>
                    {known
                      ? `${known.label}${known.recommended ? " \u2605" : ""}`
                      : id}
                  </option>
                );
              })}
            </select>
          ) : activeProvider ? (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition appearance-none pr-10"
            >
              {activeProvider.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.recommended ? " \u2605" : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODEL}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          )}
          {modelsFetched && liveModels.length > 0 && (
            <p className="text-[11px] text-emerald-600 mt-1">
              {liveModels.length} models loaded from your account
            </p>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 transition"
          >
            {showAdvanced ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            Base URL
          </button>
          {showAdvanced && (
            <div className="mt-2">
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={DEFAULT_BASE_URL}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Change for DeepSeek, Groq, or other OpenAI-compatible providers.
              </p>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={ignoreLocations}
            onChange={(e) => setIgnoreLocations(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <span className="text-xs font-bold text-slate-600 group-hover:text-slate-800 transition">
              Ignore location references
            </span>
            <p className="text-[11px] text-slate-400">
              Prevents city/region names from geo-targeted pages leaking into
              keywords and ads.
            </p>
          </div>
        </label>

        {saveError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {saveError}
          </p>
        )}
        <button
          type="submit"
          disabled={!apiKey.trim() || saving}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          {saving ? "Saving..." : config ? "Update" : "Save & Continue"}
        </button>
      </form>

      <div className="border-t border-slate-100">
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="w-full px-6 py-3 flex items-center justify-between text-xs font-bold text-slate-500 hover:bg-slate-50 transition"
        >
          <span>How to get your API key</span>
          {showGuide ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {showGuide && (
          <div className="px-6 pb-6 grid gap-3 sm:grid-cols-2">
            {PROVIDERS.map((provider) => {
              const isSelected =
                baseUrl === provider.baseUrl && model === provider.model;
              return (
                <button
                  key={provider.name}
                  type="button"
                  onClick={() => selectProvider(provider)}
                  className={`rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100 scale-[1.02]"
                      : "border-transparent bg-slate-50 hover:border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <h4
                      className={`text-sm font-bold ${isSelected ? "text-blue-700" : "text-slate-700"}`}
                    >
                      {provider.name}
                    </h4>
                    {isSelected ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" />
                        Selected
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-400 px-2 py-0.5">
                        Select
                      </span>
                    )}
                  </div>
                  <ol className="space-y-1">
                    {provider.steps.map((step, i) => (
                      <li
                        key={i}
                        className={`text-xs flex items-start gap-1.5 ${isSelected ? "text-blue-600" : "text-slate-500"}`}
                      >
                        <span
                          className={`shrink-0 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center mt-0.5 ${
                            isSelected
                              ? "bg-blue-200 text-blue-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span
                      className={`text-[11px] ${isSelected ? "text-blue-500" : "text-slate-400"}`}
                    >
                      Model:{" "}
                      <code
                        className={
                          isSelected ? "text-blue-600" : "text-slate-500"
                        }
                      >
                        {provider.model}
                      </code>
                    </span>
                    <a
                      href={provider.keyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
                    >
                      Get key <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
