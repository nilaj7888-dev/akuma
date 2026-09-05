"use client";

import { motion } from "framer-motion";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: "text" | "circular" | "rectangular";
}

export function Skeleton({
  className = "",
  width,
  height,
  variant = "rectangular",
}: SkeletonProps) {
  const variants = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-md",
  };

  return (
    <motion.div
      className={`
        bg-gradient-to-r from-[var(--line)] via-[var(--panel)] to-[var(--line)]
        bg-[length:200%_100%]
        ${variants[variant]}
        ${className}
      `}
      style={{ width, height }}
      animate={{
        backgroundPosition: ["0% 0%", "100% 0%"],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "linear",
      }}
    />
  );
}

export function MetricSkeleton() {
  return (
    <div className="metric">
      <div className="space-y-3">
        <Skeleton width="60%" height="12px" />
        <Skeleton width="80%" height="28px" />
        <Skeleton width="40%" height="10px" />
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="border border-[var(--line)] bg-[var(--panel)] rounded-lg p-4">
      <div className="space-y-3">
        <Skeleton width="40%" height="14px" />
        <Skeleton width="100%" height="60px" />
        <div className="flex gap-2">
          <Skeleton width="30%" height="10px" />
          <Skeleton width="30%" height="10px" />
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton variant="circular" width="32px" height="32px" />
          <div className="flex-1 space-y-2">
            <Skeleton width="60%" height="12px" />
            <Skeleton width="40%" height="10px" />
          </div>
          <Skeleton width="80px" height="24px" />
        </div>
      ))}
    </div>
  );
}
