"use client";

import { motion } from "framer-motion";
import { ReactNode, ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary: "bg-[var(--amber)] text-[#21160d] hover:shadow-lg hover:shadow-[var(--amber)]/20",
    secondary: "bg-[var(--panel)] border border-[var(--line)] text-[var(--ink)] hover:border-[var(--amber)]",
    ghost: "bg-transparent text-[var(--muted)] hover:text-[var(--amber)] hover:bg-[var(--panel)]",
    danger: "bg-[#dc2626] text-white hover:bg-[#b91c1c]",
  };

  const sizes = {
    sm: "text-[10px] px-3 py-1.5 gap-1.5",
    md: "text-[11px] px-4 py-2.5 gap-2",
    lg: "text-[12px] px-5 py-3 gap-2.5",
  };

  return (
    <motion.button
      className={`
        flex items-center justify-center font-bold rounded-md
        transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      disabled={disabled || loading}
      type={props.type || "button"}
      onClick={props.onClick}
    >
      {loading ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </motion.button>
  );
}
