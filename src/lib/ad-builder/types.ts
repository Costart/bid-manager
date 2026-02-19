export interface AdGroup {
  id: string;
  name: string;
  keywords: string[];
  headlines: string[];
  descriptions: string[];
  landingPageUrl: string;
  isDSA?: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  adGroups: AdGroup[];
  totalEstimatedTraffic?: string;
}

export interface FolderNode {
  name: string;
  path: string;
  depth: number;
  children: FolderNode[];
  isCampaign?: boolean;
}

export interface SiteAnalysis {
  siteName: string;
  structureSummary: string;
  campaigns: Campaign[];
}

export enum AnalysisStatus {
  IDLE = "IDLE",
  MAPPING = "MAPPING",
  SELECTING = "SELECTING",
  GENERATING = "GENERATING",
  COMPLETED = "COMPLETED",
  ERROR = "ERROR",
}

export interface ProcessLog {
  timestamp: string;
  message: string;
  type: "info" | "success" | "warning";
}

export interface MappingResult {
  siteName: string;
  folders: FolderNode[];
  stats: {
    totalUrls: number;
    depthsFound: number;
    topLevelFolders: string[];
  };
}

export interface AIDebugInfo {
  step:
    | "IDLE"
    | "FETCHING_PAGE"
    | "GENERATING_KEYWORDS"
    | "GENERATING_ADS"
    | "PARSING_JSON"
    | "COMPLETE"
    | "ERROR";
  model: string;
  targetUrl: string;
  extractedContentSnippet?: string;
  promptSnippet?: string;
  rawResponse?: string;
  timestamp: number;
}

export interface AIHistoryEntry extends AIDebugInfo {
  id: string;
  durationMs: number;
  fullPrompt: string;
}
