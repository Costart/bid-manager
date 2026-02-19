"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/ui/Card";

interface FileUploadProps {
  onFileLoaded: (csvText: string) => void;
  disabled?: boolean;
}

export function FileUpload({ onFileLoaded, disabled }: FileUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      onFileLoaded(text);
    };
    reader.onerror = () => {
      setError("Failed to read file");
      setFileName(null);
    };
    reader.readAsText(file);
  };

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">
        Upload Google Ads CSV
      </h2>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleChange}
        disabled={disabled}
        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
      />
      {fileName && (
        <p className="mt-2 text-xs text-gray-500">Loaded: {fileName}</p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </Card>
  );
}
