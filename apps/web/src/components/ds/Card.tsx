import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[12px]",
        "shadow-[0_1px_3px_rgba(11,18,32,0.06)]",
        onClick && "cursor-pointer hover:border-[var(--border-strong)] transition-colors",
        className
      )}
    >
      {children}
    </Tag>
  );
}
