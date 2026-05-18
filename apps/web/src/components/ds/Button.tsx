import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:   "bg-[var(--ink-900)] text-white border-[var(--ink-900)] hover:bg-[var(--ink-800)]",
  accent:    "bg-[var(--brand-600)] text-white border-[var(--brand-700)] hover:bg-[var(--brand-700)]",
  secondary: "bg-transparent text-[var(--ink-900)] border-[var(--ink-900)] hover:bg-[var(--slate-50)]",
  ghost:     "bg-transparent text-[var(--ink-900)] border-transparent hover:bg-[var(--slate-100)]",
  danger:    "bg-transparent text-[var(--coral-600)] border-[var(--coral-600)] hover:bg-[var(--coral-100)]",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-[34px] px-3 text-[13px]",
  md: "h-[44px] px-[18px] text-[14px]",
  lg: "h-[52px] px-5 text-[15px]",
};

export function Button({
  variant = "primary",
  size = "md",
  full = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[12px] border font-semibold transition-all",
        "disabled:opacity-45 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        full && "w-full",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
