"use client";

import React, { useState } from "react";
import { Globe, FileText, Send, Zap, List, Info } from "lucide-react";

interface AnalysisFormProps {
  onSubmit: (url: string, sitemapUrl?: string, rawUrls?: string) => void;
  defaultUrl?: string;
  defaultSitemapUrl?: string;
}

const AnalysisForm: React.FC<AnalysisFormProps> = ({
  onSubmit,
  defaultUrl,
  defaultSitemapUrl,
}) => {
  const [url, setUrl] = useState(defaultUrl || "");
  const [sitemapUrl, setSitemapUrl] = useState(defaultSitemapUrl || "");
  const [rawUrls, setRawUrls] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) onSubmit(url, sitemapUrl, rawUrls);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 md:p-10 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50"></div>

      <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
        <div className="space-y-4">
          <label className="block">
            <span className="text-slate-700 font-semibold text-lg flex items-center gap-2 mb-2">
              <Globe className="w-5 h-5 text-blue-500" />
              Target Website Domain
            </span>
            <input
              type="url"
              required
              placeholder="https://example.com"
              className="w-full px-5 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-lg bg-slate-50/50 shadow-inner"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
            >
              <Zap className="w-3 h-3" />
              {showAdvanced
                ? "Hide Fast Options"
                : "Use Direct URL List (Best for missing pages)"}
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-800 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  <strong>Tip:</strong> The automated crawler uses public search
                  data and may miss non-indexed pages. For 100% accuracy, export
                  URLs from a tool like Screaming Frog and paste them below.
                </p>
              </div>

              <label className="block">
                <span className="text-slate-600 font-semibold text-sm flex items-center gap-2 mb-2">
                  <List className="w-4 h-4 text-slate-400" />
                  Paste URL List (One per line)
                </span>
                <textarea
                  placeholder={"https://site.com/services/roofing\nhttps://site.com/services/siding..."}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-sm bg-slate-50/50 min-h-[150px] font-mono"
                  value={rawUrls}
                  onChange={(e) => setRawUrls(e.target.value)}
                />
              </label>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink mx-4 text-slate-300 text-[10px] font-bold uppercase">
                  Or use automated crawler
                </span>
                <div className="flex-grow border-t border-slate-100"></div>
              </div>

              <label className="block">
                <span className="text-slate-600 font-semibold text-sm flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Direct Sitemap URL (Optional)
                </span>
                <input
                  type="url"
                  placeholder="https://example.com/sitemap.xml"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-sm bg-slate-50/50"
                  value={sitemapUrl}
                  onChange={(e) => setSitemapUrl(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
        >
          <Send className="w-5 h-5" />
          Map Folder Structure
        </button>
      </form>
    </div>
  );
};

export default AnalysisForm;
