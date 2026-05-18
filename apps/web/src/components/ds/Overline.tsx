import { cn } from "@/lib/utils";

interface OverlineProps {
  children: React.ReactNode;
  className?: string;
}

export function Overline({ children, className }: OverlineProps) {
  return (
    <span
      className={cn(
        "text-[11px] font-semibold tracking-[0.16em] uppercase text-[var(--fg-3)]",
        className
      )}
    >
      {children}
    </span>
  );
}
