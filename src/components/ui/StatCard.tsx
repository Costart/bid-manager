import { cn } from "@/lib/utils";

interface StatCardProps {
  value: string | number;
  label: string;
  className?: string;
}

export function StatCard({ value, label, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-gray-50 p-4 rounded-xl text-center",
        className
      )}
    >
      <div className="text-2xl font-bold text-blue-600">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
