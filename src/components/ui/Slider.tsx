import { cn } from "@/lib/utils";
import { InputHTMLAttributes } from "react";

interface SliderProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  displayValue?: string;
}

export function Slider({
  className,
  label,
  displayValue,
  ...props
}: SliderProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {displayValue && (
            <span className="ml-2 font-bold text-gray-900">{displayValue}</span>
          )}
        </label>
      )}
      <input
        type="range"
        className={cn("w-full accent-blue-600", className)}
        {...props}
      />
    </div>
  );
}
