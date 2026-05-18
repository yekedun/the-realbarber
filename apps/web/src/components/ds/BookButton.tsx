interface BookButtonProps {
  time: string | null;
  disabled?: boolean;
  onClick?: () => void;
}

export function BookButton({ time, disabled = false, onClick }: BookButtonProps) {
  return (
    <button
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className="w-full h-14 rounded-[12px] flex items-center justify-center gap-2 text-base font-semibold transition-colors disabled:cursor-not-allowed"
      style={{
        backgroundColor: disabled ? "var(--slate-200)" : "var(--ink-900)",
        color: disabled ? "var(--fg-4)" : "#fff",
      }}
    >
      {time ? `${time}'da Devam Et` : "Saat Seç"}
      {time && <span className="opacity-60">›</span>}
    </button>
  );
}
