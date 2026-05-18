import { cn } from "@/lib/utils";

const TR_DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

interface DateRailProps {
  selected: number;
  onSelect: (index: number) => void;
  days?: number;
  startDate?: Date;
}

export function DateRail({ selected, onSelect, days = 14, startDate }: DateRailProps) {
  const base = startDate ?? new Date();
  const list = Array.from({ length: days }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d;
  });

  return (
    <div className="flex gap-2 overflow-x-auto pb-1.5">
      {list.map((d, i) => {
        const isSel = selected === i;
        return (
          <div
            key={i}
            onClick={() => onSelect(i)}
            className={cn(
              "flex-[0_0_70px] h-[84px] rounded-[12px] cursor-pointer",
              "flex flex-col items-center justify-center gap-[3px]",
              "border-[1.5px] transition-colors",
              isSel
                ? "border-[var(--ink-900)] bg-[var(--ink-900)] text-white"
                : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-1)]"
            )}
          >
            <div className="text-[10px] font-semibold tracking-[0.14em] uppercase opacity-75">
              {TR_DAYS[(d.getDay() + 6) % 7]}
            </div>
            <div className="text-[22px] font-bold tabular-nums leading-none">{d.getDate()}</div>
            <div className="text-[10px] font-semibold tracking-[0.08em] opacity-75">
              {TR_MONTHS[d.getMonth()]}
            </div>
          </div>
        );
      })}
    </div>
  );
}
