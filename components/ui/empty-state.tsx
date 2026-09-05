"use client";

import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <motion.div
      className={`
        flex flex-col items-center justify-center
        min-h-[300px] p-8 text-center
        ${className}
      `}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {Icon && (
        <motion.div
          className="mb-4 text-[var(--muted)]"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring" }}
        >
          <Icon size={48} strokeWidth={1.5} />
        </motion.div>
      )}

      <h3 className="text-lg font-semibold text-[var(--ink)] mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-[var(--muted)] max-w-md mb-6">
          {description}
        </p>
      )}

      {action && (
        <motion.button
          className="primary-button"
          onClick={action.onClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {action.icon}
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
}
