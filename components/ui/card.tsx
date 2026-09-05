"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  hover?: boolean;
  gradient?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = "", style, hover = false, gradient = false, onClick }: CardProps) {
  const Component = onClick ? motion.button : motion.div;

  return (
    <Component
      className={`
        border border-[var(--line)] rounded-lg
        ${gradient ? "bg-gradient-to-br from-[var(--panel)] to-[#1a1c1f]" : "bg-[var(--panel)]"}
        ${hover ? "transition-all duration-300 hover:border-[var(--amber)] hover:-translate-y-1 hover:shadow-lg" : ""}
        ${onClick ? "cursor-pointer text-left" : ""}
        ${className}
      `}
      style={style}
      onClick={onClick}
      whileHover={hover ? { y: -4 } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`border-b border-[var(--line)] px-4 py-3 ${className}`} style={style}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`px-4 py-4 ${className}`} style={style}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`border-t border-[var(--line)] px-4 py-3 ${className}`} style={style}>
      {children}
    </div>
  );
}
