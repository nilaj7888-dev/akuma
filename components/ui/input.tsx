"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wide">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full px-3 py-2.5 text-[11px]
              bg-[var(--panel)] border border-[var(--line)]
              text-[var(--ink)] placeholder:text-[var(--muted)]
              rounded-md outline-none transition-all
              focus:border-[var(--amber)] focus:ring-2 focus:ring-[var(--amber)]/20
              disabled:opacity-50 disabled:cursor-not-allowed
              ${icon ? "pl-10" : ""}
              ${error ? "border-red-500" : ""}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && (
          <p className="text-[10px] text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
