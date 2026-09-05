"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface MetricTileProps {
  label: string;
  value: string | number;
  delta?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
  className?: string;
}

export function MetricTile({
  label,
  value,
  delta,
  icon: Icon,
  trend = "neutral",
  loading = false,
  className = "",
}: MetricTileProps) {
  const trendColors = {
    up: "text-[var(--green)]",
    down: "text-red-400",
    neutral: "text-[var(--muted)]",
  };

  if (loading) {
    return (
      <div className={`metric ${className}`}>
        <div className="animate-pulse">
          <div className="h-3 bg-[var(--line)] rounded w-24 mb-4" />
          <div className="h-8 bg-[var(--line)] rounded w-32 mb-2" />
          <div className="h-3 bg-[var(--line)] rounded w-16" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={`metric ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="metric-label">
        <span>{label}</span>
        {Icon && <Icon size={16} />}
      </div>
      <strong>{value}</strong>
      {delta && (
        <small className={trendColors[trend]}>
          {trend === "up" ? "↗" : trend === "down" ? "↘" : "→"} {delta}
        </small>
      )}
    </motion.div>
  );
}

interface MetricGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function MetricGrid({ children, columns = 4, className = "" }: MetricGridProps) {
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-3 my-6 ${className}`}>
      {children}
    </div>
  );
}
