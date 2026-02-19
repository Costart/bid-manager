"use client";

import React, { useEffect, useRef } from "react";
import { ProcessLog } from "@/lib/ad-builder/types";
import { Terminal } from "lucide-react";

interface LogConsoleProps {
  logs: ProcessLog[];
}

const LogConsole: React.FC<LogConsoleProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden font-mono text-sm">
      <div className="bg-slate-800 px-4 py-2 flex items-center gap-2 border-b border-slate-700">
        <Terminal className="w-4 h-4 text-slate-400" />
        <span className="text-slate-300 font-bold text-xs uppercase tracking-widest">
          Process Log
        </span>
        <div className="flex gap-1.5 ml-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
        </div>
      </div>
      <div className="p-4 h-48 overflow-y-auto space-y-1">
        {logs.length === 0 && (
          <div className="text-slate-600 animate-pulse">
            Waiting for process start...
          </div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
            <span
              className={
                log.type === "success"
                  ? "text-emerald-400"
                  : log.type === "warning"
                    ? "text-amber-400"
                    : "text-blue-300"
              }
            >
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default LogConsole;
