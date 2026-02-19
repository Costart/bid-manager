"use client";

import React, { useState } from "react";
import { FolderNode } from "@/lib/ad-builder/types";
import {
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Send,
  CheckCircle2,
  Circle,
  CheckSquare,
  Square,
} from "lucide-react";

interface FolderMapperProps {
  siteName: string;
  folders: FolderNode[];
  stats: {
    totalUrls: number;
    depthsFound: number;
    topLevelFolders: string[];
  };
  onConfirm: (selectedPaths: string[]) => void;
  onBack: () => void;
  existingPaths?: string[];
}

interface FolderItemProps {
  node: FolderNode;
  level: number;
  siteName: string;
  selectedPaths: Set<string>;
  expandedPaths: Set<string>;
  existingPathsSet: Set<string>;
  onToggleSelection: (node: FolderNode) => void;
  onToggleExpand: (path: string) => void;
}

const FolderItem: React.FC<FolderItemProps> = ({
  node,
  level,
  siteName,
  selectedPaths,
  expandedPaths,
  existingPathsSet,
  onToggleSelection,
  onToggleExpand,
}) => {
  const isSelected = selectedPaths.has(node.path);
  const isExisting = existingPathsSet.has(node.path);
  const isExpanded = expandedPaths.has(node.path);
  const hasChildren = node.children && node.children.length > 0;
  const isRoot = level === 0;

  return (
    <div className="select-none">
      <div
        className={`
          flex items-center gap-2 py-2 px-3 transition-colors cursor-pointer border-b border-slate-50
          ${isExisting ? "bg-slate-50 opacity-60" : isSelected ? "bg-blue-50" : "hover:bg-slate-50"}
        `}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
        onClick={() => hasChildren && onToggleExpand(node.path)}
      >
        <div className="w-5 flex items-center justify-center shrink-0">
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(node.path);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}
        </div>

        <div className="shrink-0">
          {hasChildren ? (
            <Folder
              className={`w-5 h-5 ${isSelected ? "text-blue-500 fill-blue-100" : "text-amber-400 fill-amber-100"}`}
            />
          ) : (
            <FileText className="w-4 h-4 text-slate-300" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <span
            className={`font-medium text-sm truncate ${isSelected ? "text-blue-700" : "text-slate-700"}`}
          >
            {node.name || (isRoot ? siteName : "Unknown")}
          </span>
          {hasChildren && (
            <span className="ml-2 text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
              {node.children.length}
            </span>
          )}
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          {isExisting ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Generated
            </span>
          ) : (
            <button
              onClick={() => onToggleSelection(node)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                ${
                  isSelected
                    ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600"
                }
              `}
            >
              {isSelected ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Campaign</span>
                </>
              ) : (
                <>
                  <Circle className="w-3.5 h-3.5" />
                  <span>Select</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="border-l border-slate-100 ml-[calc(12px+10px)]">
          {node.children.map((child) => (
            <FolderItem
              key={child.path}
              node={child}
              level={level + 1}
              siteName={siteName}
              selectedPaths={selectedPaths}
              expandedPaths={expandedPaths}
              existingPathsSet={existingPathsSet}
              onToggleSelection={onToggleSelection}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FolderMapper: React.FC<FolderMapperProps> = ({
  siteName,
  folders,
  onConfirm,
  onBack,
  existingPaths = [],
}) => {
  const existingPathsSet = new Set(existingPaths);

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    folders.forEach((root) => {
      root.children?.forEach((child) => {
        if (!existingPathsSet.has(child.path)) {
          initial.add(child.path);
        }
      });
    });
    return initial;
  });

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    new Set(["/"]),
  );

  const handleToggleNode = (node: FolderNode) => {
    if (existingPathsSet.has(node.path)) return;

    const nextSelection = new Set(selectedPaths);

    if (nextSelection.has(node.path)) {
      nextSelection.delete(node.path);

      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => {
          if (!existingPathsSet.has(child.path)) {
            nextSelection.add(child.path);
          }
        });

        setExpandedPaths((prev) => {
          const nextExpanded = new Set(prev);
          nextExpanded.add(node.path);
          return nextExpanded;
        });
      }
    } else {
      nextSelection.add(node.path);

      if (node.children) {
        node.children.forEach((child) => nextSelection.delete(child.path));
      }
    }

    setSelectedPaths(nextSelection);
  };

  const toggleExpand = (path: string) => {
    const newSet = new Set(expandedPaths);
    if (newSet.has(path)) {
      newSet.delete(path);
    } else {
      newSet.add(path);
    }
    setExpandedPaths(newSet);
  };

  const handleSelectAll = () => {
    const all = new Set<string>();
    const traverse = (nodes: FolderNode[]) => {
      nodes.forEach((node) => {
        if (!existingPathsSet.has(node.path)) {
          all.add(node.path);
        }
        if (node.children) traverse(node.children);
      });
    };
    traverse(folders);
    setSelectedPaths(all);
  };

  const handleSelectNone = () => {
    setSelectedPaths(new Set());
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedPaths));
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
      <div className="bg-white border-b border-slate-100 p-6 flex justify-between items-center shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Select Campaigns
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-slate-500">
                Found {folders.length > 0 ? folders[0].children.length : 0}{" "}
                top-level items.
              </p>
              <div className="h-4 w-px bg-slate-200"></div>
              <button
                onClick={handleSelectAll}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition flex items-center gap-1"
              >
                <CheckSquare className="w-3 h-3" />
                Select All
              </button>
              <button
                onClick={handleSelectNone}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 px-2 py-1 rounded transition flex items-center gap-1"
              >
                <Square className="w-3 h-3" />
                Select None
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleConfirm}
          disabled={selectedPaths.size === 0}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg
            ${
              selectedPaths.size > 0
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
                : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
            }
          `}
        >
          <span>Generate {selectedPaths.size} Campaigns</span>
          <Send className="w-4 h-4" />
        </button>
      </div>

      {existingPaths.length > 0 && (
        <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2 text-sm shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="text-emerald-700 font-medium">
            {existingPaths.length} campaign
            {existingPaths.length !== 1 ? "s" : ""} already generated
          </span>
          <span className="text-emerald-500">
            — select new paths below to add more
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {folders.map((root) => (
          <div key={root.path}>
            <FolderItem
              node={root}
              level={0}
              siteName={siteName}
              selectedPaths={selectedPaths}
              expandedPaths={expandedPaths}
              existingPathsSet={existingPathsSet}
              onToggleSelection={handleToggleNode}
              onToggleExpand={toggleExpand}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default FolderMapper;
