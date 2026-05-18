import { cn } from "@/lib/utils";

interface StaffOption {
  id: string;
  name: string;
  role?: string;
}

interface StaffPickerProps {
  staff: StaffOption[];
  selected: string | null;
  onSelect: (id: string) => void;
}

export function StaffPicker({ staff, selected, onSelect }: StaffPickerProps) {
  const optionCls = (id: string) =>
    cn(
      "p-3.5 rounded-[12px] cursor-pointer border-[1.5px] transition-all",
      selected === id
        ? "border-[var(--ink-900)] bg-[var(--ink-900)] text-white"
        : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-1)]"
    );

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5">
      <div onClick={() => onSelect("any")} className={optionCls("any")}>
        <div className="text-[15px] font-semibold">Fark Etmez</div>
        <div className={cn("text-[12px] mt-1", selected === "any" ? "opacity-65" : "text-[var(--fg-3)]")}>
          Uygun personele atanır
        </div>
      </div>
      {staff.map((s) => (
        <div key={s.id} onClick={() => onSelect(s.id)} className={cn(optionCls(s.id), "flex items-center gap-3")}>
          <div
            className={cn(
              "w-[34px] h-[34px] rounded-full flex items-center justify-center text-[13px] font-bold shrink-0",
              selected === s.id ? "bg-white/[0.16] text-white" : "bg-[var(--slate-100)] text-[var(--ink-900)]"
            )}
          >
            {s.name[0]}
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold truncate">{s.name}</div>
            {s.role && (
              <div className={cn("text-[11px] mt-0.5", selected === s.id ? "opacity-65" : "text-[var(--fg-3)]")}>
                {s.role}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
