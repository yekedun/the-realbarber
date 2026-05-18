import { cn } from "@/lib/utils";

interface ServiceRowProps {
  name: string;
  duration: number;
  price: number;
  selected?: boolean;
  onClick?: () => void;
}

export function ServiceRow({ name, duration, price, selected = false, onClick }: ServiceRowProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-4 px-[18px] py-4 rounded-[12px] cursor-pointer transition-all",
        "border-[1.5px]",
        selected
          ? "border-[var(--ink-900)] bg-[var(--ink-900)] text-white"
          : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-1)]"
      )}
    >
      <div>
        <div className="text-base font-semibold">{name}</div>
        <div className={cn("text-[13px] mt-1", selected ? "opacity-65" : "text-[var(--fg-3)]")}>
          {duration} dk
        </div>
      </div>
      <div className="text-[18px] font-bold tabular-nums shrink-0">{price}₺</div>
    </div>
  );
}
