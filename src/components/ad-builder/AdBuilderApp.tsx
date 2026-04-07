"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  fetchRawUrls,
  generateSingleCampaign,
  batchFixAdCopy,
  groupUrlsByLanguage,
  detectLangFromUrlPath,
} from "@/lib/ad-builder/geminiService";
import {
  buildTreeFromUrls,
  getStats,
  findNodeByPath,
} from "@/lib/ad-builder/treeBuilder";
import {
  AnalysisStatus,
  SiteAnalysis,
  MappingResult,
  ProcessLog,
  AIDebugInfo,
  AIHistoryEntry,
  LanguageGroup,
} from "@/lib/ad-builder/types";
import { AIConfig, loadAIConfigFromServer } from "@/lib/ad-builder/aiConfig";
import AnalysisForm from "@/components/ad-builder/AnalysisForm";
import APISettings from "@/components/ad-builder/APISettings";
import Dashboard from "@/components/ad-builder/Dashboard";
import FolderMapper from "@/components/ad-builder/FolderMapper";
import LogConsole from "@/components/ad-builder/LogConsole";
import {
  Layout,
  AlertCircle,
  Loader2,
  FolderOpen,
  Trash2,
  Clock,
  BarChart3,
} from "lucide-react";

interface SavedProject {
  id: string;
  projectName: string;
  targetUrl: string;
  status: string;
  campaignCount: number;
  adGroupCount: number;
  createdAt: string;
  updatedAt: string;
}

async function fetchProjects(): Promise<SavedProject[]> {
  const res = await fetch("/api/ad-projects");
  if (!res.ok) return [];
  const data = await res.json();
  return data.projects || [];
}

async function createProject(
  projectName: string,
  targetUrl: string,
  sitemapUrl?: string,
): Promise<string> {
  const res = await fetch("/api/ad-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectName, targetUrl, sitemapUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data.id;
}

async function updateProject(
  id: string,
  updates: Record<string, any>,
): Promise<void> {
  const res = await fetch(`/api/ad-projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to update project");
  }
}

async function loadProject(id: string) {
  const res = await fetch(`/api/ad-projects/${id}`);
  if (!res.ok) throw new Error("Failed to load project");
  const data = await res.json();
  return data.project;
}

async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/ad-projects/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete project");
}

export default function AdBuilderApp() {
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [url, setUrl] = useState<string>("");
  const [sitemapUrl, setSitemapUrl] = useState<string | undefined>(undefined);
  const [mappingResult, setMappingResult] = useState<MappingResult | null>(
    null,
  );
  const [analysis, setAnalysis] = useState<SiteAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ProcessLog[]>([]);
  const [totalWork, setTotalWork] = useState<number>(0);
  const [currentProcessingEntity, setCurrentProcessingEntity] = useState<
    string | undefined
  >(undefined);
  const [currentDebugInfo, setCurrentDebugInfo] = useState<
    AIDebugInfo | undefined
  >(undefined);
  const [aiHistory, setAiHistory] = useState<AIHistoryEntry[]>([]);
  const [isFixingCompliance, setIsFixingCompliance] = useState(false);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [existingPaths, setExistingPaths] = useState<string[]>([]);

  const [languageGroups, setLanguageGroups] = useState<LanguageGroup[]>([]);

  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const config = await loadAIConfigFromServer();
        setAiConfig(config);
      } catch {
        setAiConfig(null);
      } finally {
        setConfigLoaded(true);
      }

      try {
        const projects = await fetchProjects();
        setSavedProjects(projects);
      } catch {
        // ignore
      } finally {
        setLoadingProjects(false);
      }
    }
    init();
  }, []);

  const handleLoadProject = async (id: string) => {
    setLoadingProjectId(id);
    try {
      const p = await loadProject(id);
      setProjectId(p.id);
      setProjectName(p.project_name);
      setUrl(p.target_url || "");
      setSitemapUrl(p.sitemap_url || undefined);

      if (p.site_analysis) {
        setAnalysis(p.site_analysis);
        // Restore existing paths from saved data, enriched from campaign landing pages
        const savedPaths = new Set<string>(p.selected_paths || []);
        // Also derive paths from campaign landing page URLs for robustness
        const siteAnalysis = p.site_analysis as SiteAnalysis;
        for (const camp of siteAnalysis.campaigns || []) {
          for (const ag of camp.adGroups || []) {
            if (ag.landingPageUrl) {
              try {
                const pathname = new URL(ag.landingPageUrl).pathname;
                // Add the parent path (campaign level) — e.g. /en/services from /en/services/web
                const segments = pathname.split("/").filter(Boolean);
                // Try different depths to match tree nodes
                for (let i = 1; i <= segments.length; i++) {
                  savedPaths.add("/" + segments.slice(0, i).join("/"));
                }
              } catch {
                // ignore
              }
            }
          }
        }
        setExistingPaths([...savedPaths]);
        setStatus(AnalysisStatus.COMPLETED);
      } else if (p.folder_tree) {
        const siteDisplayName = p.project_name;
        const stats = getStats(p.folder_tree);
        setMappingResult({
          siteName: siteDisplayName,
          folders: p.folder_tree,
          stats: {
            totalUrls: p.discovered_urls?.length || 0,
            depthsFound: stats.maxDepth,
            topLevelFolders: stats.topLevels,
          },
        });
        setDiscoveredUrls(p.discovered_urls || []);
        setExistingPaths(p.selected_paths || []);
        setStatus(AnalysisStatus.SELECTING);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load project");
    } finally {
      setLoadingProjectId(null);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteProject(id);
      setSavedProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // ignore
    }
  };

  const addLog = (
    message: string,
    type: "info" | "success" | "warning" = "info",
  ) => {
    setLogs((prev) => [
      ...prev,
      {
        timestamp: new Date().toLocaleTimeString([], {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        message,
        type,
      },
    ]);
  };

  const saveProjectUpdate = useCallback(
    async (updates: Record<string, any>) => {
      if (!projectId) return;
      try {
        await updateProject(projectId, updates);
      } catch (e) {
        console.error("Auto-save failed:", e);
      }
    },
    [projectId],
  );

  const handleStartMapping = async (
    targetUrl: string,
    inputSitemapUrl?: string,
    rawUrls?: string,
  ) => {
    if (!aiConfig) return;

    let targetUrlFixed = targetUrl.trim();
    if (targetUrlFixed && !/^https?:\/\//i.test(targetUrlFixed)) {
      targetUrlFixed = "https://" + targetUrlFixed;
    }

    setUrl(targetUrlFixed);
    setSitemapUrl(inputSitemapUrl);
    setStatus(AnalysisStatus.MAPPING);
    setLogs([]);
    setError(null);
    setAiHistory([]);

    addLog(`Initiating Path Segment Analyzer...`);

    try {
      let urls: string[] = [];
      let detectedLanguages: LanguageGroup[] = [];

      if (rawUrls) {
        addLog(`Processing manual URL list...`, "success");
        urls = rawUrls
          .split("\n")
          .map((u) => u.trim())
          .filter((u) => u.length > 0);
      } else {
        addLog(`Crawling sitemaps...`, "info");
        const result = await fetchRawUrls(targetUrlFixed, inputSitemapUrl);
        urls = result.urls;
        detectedLanguages = groupUrlsByLanguage(urls, result.hreflangMap);
        if (detectedLanguages.length > 0) {
          addLog(
            `Detected ${detectedLanguages.length} languages: ${detectedLanguages.map((g) => `${g.displayName} (${g.urls.length} pages)`).join(", ")}`,
            "success",
          );
        }
      }
      setLanguageGroups(detectedLanguages);

      if (urls.length === 0) {
        throw new Error(
          "No URLs were discovered for this site. Try pasting a URL list in 'Fast Options'.",
        );
      }

      addLog(`Discovered ${urls.length} target pages.`, "success");
      addLog(`Mapping folder hierarchy (Site Root = Level 1)...`, "info");

      const siteDisplayName = targetUrlFixed
        .replace(/^https?:\/\/(www\.)?/, "")
        .split("/")[0]
        .toUpperCase();
      const folders = buildTreeFromUrls(urls, siteDisplayName);
      const stats = getStats(folders);

      addLog(
        `Mapping complete: ${stats.maxDepth} levels identified.`,
        "success",
      );

      const mappingData: MappingResult = {
        siteName: siteDisplayName,
        folders,
        stats: {
          totalUrls: urls.length,
          depthsFound: stats.maxDepth,
          topLevelFolders: stats.topLevels,
        },
      };

      setMappingResult(mappingData);
      setDiscoveredUrls(urls);

      if (!projectId) {
        try {
          const id = await createProject(
            siteDisplayName,
            targetUrlFixed,
            inputSitemapUrl,
          );
          setProjectId(id);
          setProjectName(siteDisplayName);
          await updateProject(id, {
            discoveredUrls: urls,
            folderTree: folders,
          });
        } catch (e) {
          console.error("Failed to create project:", e);
        }
      } else {
        const allUrls = [...new Set([...existingPaths, ...urls])];
        saveProjectUpdate({
          discoveredUrls: allUrls,
          folderTree: folders,
        });
      }

      setStatus(AnalysisStatus.SELECTING);
    } catch (err: any) {
      addLog(`Process halted: ${err.message}`, "warning");
      setError(err.message || "Mapping failed.");
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const handleGenerateAds = async (
    selectedPaths: string[],
    selectedLanguages?: LanguageGroup[],
  ) => {
    if (!mappingResult || !aiConfig) return;

    // Use selected languages from FolderMapper, fall back to all detected, or null for single-lang
    const langs =
      selectedLanguages && selectedLanguages.length > 0
        ? selectedLanguages
        : languageGroups.length > 0
          ? languageGroups
          : [null];
    const totalCampaigns = selectedPaths.length * langs.length;

    setTotalWork(totalCampaigns);
    setStatus(AnalysisStatus.GENERATING);

    const langInfo =
      languageGroups.length > 0
        ? ` across ${languageGroups.length} languages`
        : "";
    addLog(
      `Starting batched generation for ${totalCampaigns} campaigns${langInfo} (${aiConfig.model})...`,
      "info",
    );

    const existingCampaigns = analysis?.campaigns || [];

    const initialAnalysis: SiteAnalysis = {
      siteName: mappingResult.siteName,
      structureSummary: `Generated structure based on ${totalCampaigns + existingCampaigns.length} sections.`,
      campaigns: [...existingCampaigns],
    };
    setAnalysis(initialAnalysis);

    let successCount = 0;
    let failCount = 0;
    let campaignIndex = 0;

    for (const langGroup of langs) {
      const langCode = langGroup?.lang;
      const langLabel = langGroup
        ? ` [${langGroup.displayName}]`
        : "";

      if (langGroup) {
        addLog(`--- Generating ${langGroup.displayName} campaigns ---`, "info");
      }

      for (const path of selectedPaths) {
        campaignIndex++;
        try {
          const node = findNodeByPath(mappingResult.folders, path);
          if (!node) {
            addLog(`Skipping ${path} (Node not found)`, "warning");
            continue;
          }

          setCurrentProcessingEntity(`${node.name}${langLabel}`);
          addLog(
            `Generating Campaign ${campaignIndex}/${totalCampaigns}: ${node.name}${langLabel}...`,
            "info",
          );

          let startTime = Date.now();
          let promptCaptured = "";

          const campaign = await generateSingleCampaign(
            aiConfig,
            url,
            mappingResult.siteName,
            node,
            (debugUpdate) => {
              if (debugUpdate.fullPrompt) {
                promptCaptured = debugUpdate.fullPrompt;
              }

              setCurrentDebugInfo(
                (prev) =>
                  ({
                    ...(prev || {
                      step: "IDLE",
                      model: "",
                      targetUrl: "",
                      timestamp: 0,
                    }),
                    ...debugUpdate,
                  }) as AIDebugInfo,
              );

              if (
                debugUpdate.step === "COMPLETE" ||
                debugUpdate.step === "ERROR"
              ) {
                const entry: AIHistoryEntry = {
                  ...debugUpdate,
                  step: debugUpdate.step,
                  model: debugUpdate.model || aiConfig.model,
                  targetUrl: debugUpdate.targetUrl || "",
                  timestamp: Date.now(),
                  id: `log-${Date.now()}`,
                  durationMs: Date.now() - startTime,
                  fullPrompt: promptCaptured || debugUpdate.fullPrompt || "",
                };
                setAiHistory((prev) => [entry, ...prev]);
              }
            },
            langCode,
          );

          setAnalysis((prev) => {
            if (!prev) return initialAnalysis;
            const updated = {
              ...prev,
              campaigns: [...prev.campaigns, campaign],
            };
            saveProjectUpdate({ siteAnalysis: updated });
            return updated;
          });

          successCount++;
          addLog(`Completed: ${campaign.name}`, "success");
        } catch (err: any) {
          addLog(`Failed: ${path}${langLabel} - ${err.message}`, "warning");
          failCount++;
        }
      }
    }

    setCurrentProcessingEntity(undefined);

    const allSelectedPaths = [...new Set([...existingPaths, ...selectedPaths])];
    setExistingPaths(allSelectedPaths);

    if (successCount === 0 && failCount > 0) {
      setError(
        "All campaign generation attempts failed. Check your API key and try again.",
      );
      setStatus(AnalysisStatus.ERROR);
    } else {
      addLog(
        `Batch processing complete. ${successCount} successful, ${failCount} failed.`,
        "success",
      );
      setStatus(AnalysisStatus.COMPLETED);
      saveProjectUpdate({
        selectedPaths: allSelectedPaths,
        status: "completed",
      });
    }
  };

  const handleFixCompliance = async () => {
    if (!analysis || !aiConfig) return;
    setIsFixingCompliance(true);
    addLog(
      "Scanning for compliance errors (Headlines > 30, Desc > 90, duplicate names)...",
      "info",
    );

    // Fix duplicate campaign names first
    const nameCounts = new Map<string, number>();
    analysis.campaigns.forEach((camp) => {
      nameCounts.set(camp.name, (nameCounts.get(camp.name) || 0) + 1);
    });

    const duplicateNames = new Set(
      [...nameCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([name]) => name),
    );

    if (duplicateNames.size > 0) {
      const dupeCount = [...duplicateNames.values()].reduce(
        (sum, name) => sum + (nameCounts.get(name) || 0),
        0,
      );
      addLog(
        `Found ${dupeCount} campaigns with duplicate names. Fixing...`,
        "warning",
      );

      setAnalysis((prev) => {
        if (!prev) return null;
        const nameIndexes = new Map<string, number>();
        const fixedCampaigns = prev.campaigns.map((camp) => {
          if (!duplicateNames.has(camp.name)) return camp;

          // Try to determine language: from campaign field, or infer from landing page URLs
          let lang = camp.language;
          if (!lang) {
            const firstUrl = camp.adGroups[0]?.landingPageUrl;
            if (firstUrl) {
              lang = detectLangFromUrlPath(firstUrl) || undefined;
            }
          }

          if (lang) {
            const suffix = `[${lang.toUpperCase()}]`;
            if (!camp.name.includes(suffix)) {
              return { ...camp, name: `${camp.name} ${suffix}`, language: lang };
            }
            return camp;
          }

          // Last resort: number them
          const idx = (nameIndexes.get(camp.name) || 0) + 1;
          nameIndexes.set(camp.name, idx);
          return { ...camp, name: `${camp.name} (${idx})` };
        });
        const updated = { ...prev, campaigns: fixedCampaigns };
        saveProjectUpdate({ siteAnalysis: updated });
        return updated;
      });

      addLog(
        `Fixed ${dupeCount} duplicate campaign names.`,
        "success",
      );
    }

    const invalidItems: {
      id: string;
      text: string;
      type: "HEADLINE" | "DESCRIPTION";
      groupId: string;
      index: number;
    }[] = [];

    analysis.campaigns.forEach((camp) => {
      camp.adGroups.forEach((group) => {
        group.headlines.forEach((h, idx) => {
          if (h.length > 30) {
            invalidItems.push({
              id: `H-${group.id}-${idx}`,
              text: h,
              type: "HEADLINE",
              groupId: group.id,
              index: idx,
            });
          }
        });
        group.descriptions.forEach((d, idx) => {
          if (d.length > 90) {
            invalidItems.push({
              id: `D-${group.id}-${idx}`,
              text: d,
              type: "DESCRIPTION",
              groupId: group.id,
              index: idx,
            });
          }
        });
      });
    });

    if (invalidItems.length === 0 && duplicateNames.size === 0) {
      addLog("Analysis passed: No compliance issues found.", "success");
      setIsFixingCompliance(false);
      return;
    }

    if (invalidItems.length === 0) {
      setIsFixingCompliance(false);
      return;
    }

    addLog(
      `Found ${invalidItems.length} compliance errors. Requesting AI repairs...`,
      "warning",
    );

    try {
      const repairs = await batchFixAdCopy(
        aiConfig,
        invalidItems.map((i) => ({ id: i.id, text: i.text, type: i.type })),
      );

      setAnalysis((prev) => {
        if (!prev) return null;
        const newCampaigns = prev.campaigns.map((camp) => ({
          ...camp,
          adGroups: camp.adGroups.map((group) => {
            const groupRepairs = repairs.filter((r) => r.id.includes(group.id));
            if (groupRepairs.length === 0) return group;

            const newHeadlines = [...group.headlines];
            const newDescriptions = [...group.descriptions];

            groupRepairs.forEach((repair) => {
              if (repair.id.startsWith("H-")) {
                const idx = parseInt(repair.id.split("-").pop() || "0");
                if (newHeadlines[idx]) newHeadlines[idx] = repair.rewrittenText;
              } else if (repair.id.startsWith("D-")) {
                const idx = parseInt(repair.id.split("-").pop() || "0");
                if (newDescriptions[idx])
                  newDescriptions[idx] = repair.rewrittenText;
              }
            });

            return {
              ...group,
              headlines: newHeadlines,
              descriptions: newDescriptions,
            };
          }),
        }));
        const updated = { ...prev, campaigns: newCampaigns };
        saveProjectUpdate({ siteAnalysis: updated });
        return updated;
      });

      addLog(`Successfully repaired ${repairs.length} items.`, "success");
    } catch (e) {
      console.error("Compliance fix failed", e);
      addLog("Failed to repair items. See console.", "warning");
    } finally {
      setIsFixingCompliance(false);
    }
  };

  const handleCampaignsUploaded = (campaignIds: string[]) => {
    const idSet = new Set(campaignIds);
    setAnalysis((prev) => {
      if (!prev) return null;
      const updated = {
        ...prev,
        campaigns: prev.campaigns.map((c) =>
          idSet.has(c.id) ? { ...c, uploaded: true } : c,
        ),
      };
      saveProjectUpdate({ siteAnalysis: updated });
      return updated;
    });
  };

  const handleRescan = async () => {
    if (!url) {
      setStatus(AnalysisStatus.IDLE);
      setMappingResult(null);
      setLogs([]);
      setError(null);
      setCurrentProcessingEntity(undefined);
      setCurrentDebugInfo(undefined);
      return;
    }

    // Re-scan directly — skip the form, rebuild tree, keep existing campaigns
    setStatus(AnalysisStatus.MAPPING);
    setLogs([]);
    setError(null);
    setCurrentProcessingEntity(undefined);
    setCurrentDebugInfo(undefined);

    addLog(`Re-scanning ${url}...`, "info");

    try {
      const result = await fetchRawUrls(url, sitemapUrl);
      const urls = result.urls;
      const detectedLanguages = groupUrlsByLanguage(urls, result.hreflangMap);
      if (detectedLanguages.length > 0) {
        addLog(
          `Detected ${detectedLanguages.length} languages: ${detectedLanguages.map((g) => `${g.displayName} (${g.urls.length} pages)`).join(", ")}`,
          "success",
        );
      }
      setLanguageGroups(detectedLanguages);

      addLog(`Discovered ${urls.length} pages.`, "success");

      const siteDisplayName = url
        .replace(/^https?:\/\/(www\.)?/, "")
        .split("/")[0]
        .toUpperCase();
      const folders = buildTreeFromUrls(urls, siteDisplayName);
      const stats = getStats(folders);

      addLog(
        `Mapping complete: ${stats.maxDepth} levels identified.`,
        "success",
      );

      setMappingResult({
        siteName: siteDisplayName,
        folders,
        stats: {
          totalUrls: urls.length,
          depthsFound: stats.maxDepth,
          topLevelFolders: stats.topLevels,
        },
      });
      setDiscoveredUrls(urls);

      if (projectId) {
        const allUrls = [...new Set([...discoveredUrls, ...urls])];
        saveProjectUpdate({
          discoveredUrls: allUrls,
          folderTree: folders,
        });
      }

      setStatus(AnalysisStatus.SELECTING);
    } catch (err: any) {
      addLog(`Re-scan failed: ${err.message}`, "warning");
      setError(err.message || "Re-scan failed.");
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const reset = async () => {
    setStatus(AnalysisStatus.IDLE);
    setAnalysis(null);
    setMappingResult(null);
    setError(null);
    setLogs([]);
    setTotalWork(0);
    setCurrentProcessingEntity(undefined);
    setCurrentDebugInfo(undefined);
    setProjectId(null);
    setProjectName("");
    setDiscoveredUrls([]);
    setExistingPaths([]);
    setLanguageGroups([]);
    // Refresh project list
    try {
      const projects = await fetchProjects();
      setSavedProjects(projects);
    } catch {
      // ignore
    }
  };

  if (!configLoaded) return null;

  return (
    <div className="flex flex-col h-full">
      <header className="mb-8 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Layout className="w-8 h-8 text-blue-600" />
            Ad Builder
          </h1>
          <p className="text-slate-500 mt-2 font-medium">
            {projectName
              ? `Project: ${projectName}`
              : "Sitemap-to-Campaign Automation."}
          </p>
        </div>
        {status !== AnalysisStatus.IDLE && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-black text-slate-600 uppercase shadow-sm">
            <span
              className={`w-2 h-2 rounded-full ${status === AnalysisStatus.COMPLETED ? "bg-emerald-500" : "bg-blue-500 animate-pulse"}`}
            ></span>
            {status.replace("_", " ")}
          </div>
        )}
      </header>

      {status === AnalysisStatus.IDLE && (
        <div className="space-y-6">
          <APISettings config={aiConfig} onSave={setAiConfig} />
          {aiConfig && (
            <AnalysisForm
              onSubmit={(formUrl, sitemap, rawUrls) =>
                handleStartMapping(formUrl, sitemap, rawUrls)
              }
              defaultUrl={url}
              defaultSitemapUrl={sitemapUrl}
            />
          )}

          {/* Saved Projects */}
          {!loadingProjects && savedProjects.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-blue-600" />
                  Saved Projects
                </h3>
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                  {savedProjects.length} project
                  {savedProjects.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {savedProjects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl hover:border-slate-200 hover:bg-slate-50/50 transition group"
                  >
                    <button
                      onClick={() => handleLoadProject(p.id)}
                      className="flex-1 text-left flex items-center gap-4 min-w-0"
                      disabled={loadingProjectId === p.id}
                    >
                      {loadingProjectId === p.id ? (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                          <BarChart3 className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-800 truncate">
                          {p.projectName}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(p.updatedAt).toLocaleDateString()}
                          </span>
                          {p.campaignCount > 0 && (
                            <span>
                              {p.campaignCount} campaign
                              {p.campaignCount !== 1 ? "s" : ""} ·{" "}
                              {p.adGroupCount} ad group
                              {p.adGroupCount !== 1 ? "s" : ""}
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              p.status === "completed"
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-amber-50 text-amber-600"
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(p.id);
                      }}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                      title="Delete project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {status === AnalysisStatus.MAPPING && (
        <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-12 flex flex-col items-center justify-center text-center shadow-xl shadow-slate-200/50">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-blue-100 rounded-full blur-3xl opacity-50 scale-150"></div>
              <Loader2 className="w-20 h-20 text-blue-600 animate-spin relative" />
            </div>
            <h2 className="text-3xl font-black mb-3 text-slate-900">
              Discovering URLs
            </h2>
            <p className="text-slate-500 max-w-lg text-lg leading-relaxed">
              Check the logs below for real-time extraction progress.
            </p>
          </div>
          <LogConsole logs={logs} />
        </div>
      )}

      {status === AnalysisStatus.SELECTING && mappingResult && (
        <FolderMapper
          siteName={mappingResult.siteName}
          folders={mappingResult.folders}
          stats={mappingResult.stats}
          onConfirm={handleGenerateAds}
          onBack={
            projectId && analysis
              ? () => setStatus(AnalysisStatus.COMPLETED)
              : reset
          }
          existingPaths={existingPaths}
          languageGroups={languageGroups}
        />
      )}

      {(status === AnalysisStatus.COMPLETED ||
        status === AnalysisStatus.GENERATING) &&
        analysis && (
          <Dashboard
            analysis={analysis}
            onReset={reset}
            onRescan={handleRescan}
            isGenerating={status === AnalysisStatus.GENERATING}
            isFixing={isFixingCompliance}
            onFixCompliance={handleFixCompliance}
            onCampaignsUploaded={handleCampaignsUploaded}
            progress={{
              current:
                analysis.campaigns.length -
                (existingPaths.length > 0
                  ? analysis.campaigns.length - totalWork
                  : 0),
              total: totalWork || analysis.campaigns.length,
              currentEntity: currentProcessingEntity,
            }}
            debugInfo={currentDebugInfo}
            aiHistory={aiHistory}
          />
        )}

      {status === AnalysisStatus.ERROR && (
        <div className="bg-red-50 border border-red-200 p-12 rounded-[2.5rem] flex flex-col items-center gap-6 text-center shadow-xl shadow-red-100">
          <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center">
            <AlertCircle className="w-12 h-12 text-red-600" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-red-900">
              Oops! Something went wrong
            </h3>
            <p className="text-red-700 mt-2 max-w-md mx-auto text-lg">
              {error}
            </p>
            <button
              onClick={reset}
              className="mt-8 px-10 py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 transition active:scale-95 shadow-lg shadow-red-200"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
