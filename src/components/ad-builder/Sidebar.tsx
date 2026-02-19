"use client";

import React from "react";
import {
  Home,
  Target,
  PieChart,
  FileText,
  HelpCircle,
  Briefcase,
} from "lucide-react";

const Sidebar: React.FC = () => {
  const navItems = [
    { icon: Home, label: "Dashboard", active: true },
    { icon: Target, label: "Campaigns", active: false },
    { icon: PieChart, label: "Analytics", active: false },
    { icon: FileText, label: "Reports", active: false },
    { icon: Briefcase, label: "Tools", active: false },
    { icon: HelpCircle, label: "Support", active: false },
  ];

  return (
    <nav className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col hidden sm:flex">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
          A
        </div>
        <span className="font-bold text-xl lg:block hidden">AdAI</span>
      </div>

      <div className="flex-1 py-4 px-4 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={`w-full flex items-center gap-4 p-3 rounded-xl transition ${
              item.active
                ? "bg-blue-50 text-blue-600"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            <item.icon className="w-6 h-6" />
            <span className="font-medium lg:block hidden">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default Sidebar;
