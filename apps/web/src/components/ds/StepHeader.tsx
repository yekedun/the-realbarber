import { cn } from "@/lib/utils";

type Status = "done" | "active" | "idle";

interface StepHeaderProps {
  num: number;
  title: string;
  status: Status;
}

const circleClasses: Record<Status, string> = {
  done:   "bg-[var(--ink-900)] text-white border-[var(--ink-900)]",
  active: "bg-white text-[var(--ink-900)] border-[var(--ink-900)]",
  idle:   "bg-[var(--bg)] text-[var(--fg-4)] border-[var(--border)]",
};

export function StepHeader({ num, title, status }: StepHeaderProps) {
  return (
    <div className="flex items-center gap-3.5">
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-[1.5px] shrink-0",
          circleClasses[status]
        )}
      >
        {status === "done" ? "✓" : num}
      </div>
      <span
        className={cn(
          "text-[18px] font-semibold tracking-[-0.012em]",
          status === "idle" ? "text-[var(--fg-4)]" : "text-[var(--fg-1)]"
        )}
      >
        {title}
      </span>
    </div>
  );
}
