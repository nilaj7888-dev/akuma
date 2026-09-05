"use client";

import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "success" | "warning" | "error" | "info" | "amber" | "green";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({ children, variant = "info", size = "sm", className = "" }: BadgeProps) {
  const variants = {
    success: "bg-green-500/10 text-[var(--green)] border-green-500/20",
    warning: "bg-amber-500/10 text-[var(--amber)] border-amber-500/20",
    error: "bg-red-500/10 text-red-400 border-red-500/20",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    amber: "bg-[var(--amber)]/10 text-[var(--amber)] border-[var(--amber)]/20",
    green: "bg-[var(--green)]/10 text-[var(--green)] border-[var(--green)]/20",
  };

  const sizes = {
    sm: "text-[9px] px-2 py-1",
    md: "text-[10px] px-2.5 py-1.5",
  };

  return (
    <span
      className={`
        inline-flex items-center font-mono font-medium
        border rounded-full uppercase tracking-wider
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
