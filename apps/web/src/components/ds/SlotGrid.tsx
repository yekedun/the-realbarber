import { cn } from "@/lib/utils";

interface Slot {
  time: string;
  full?: boolean;
}

interface SlotGridProps {
  slots: Slot[];
  selected: string | null;
  onSelect: (time: string) => void;
}

export function SlotGrid({ slots, selected, onSelect }: SlotGridProps) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {slots.map((s) => {
        const isSel = s.time === selected;
        return (
          <button
            key={s.time}
            disabled={s.full}
            onClick={() => !s.full && onSelect(s.time)}
            className={cn(
              "h-[42px] rounded-[10px] text-[14px] font-semibold tabular-nums border-[1.5px] transition-all",
              isSel
                ? "border-[var(--ink-900)] bg-[var(--ink-900)] text-white"
                : s.full
                  ? "border-transparent bg-[var(--slate-100)] text-[var(--fg-4)] line-through cursor-not-allowed"
                  : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-1)] hover:border-[var(--ink-900)]"
            )}
          >
            {s.time}
          </button>
        );
      })}
    </div>
  );
}
