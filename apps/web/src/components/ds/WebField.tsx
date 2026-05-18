interface WebFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}

export function WebField({ label, value, onChange, placeholder, textarea = false }: WebFieldProps) {
  const sharedClassName =
    "font-[inherit] text-[15px] leading-[1.45] text-[var(--fg-1)] bg-[var(--bg)] border border-[var(--border)] rounded-[12px] px-3.5 py-3 outline-none w-full focus:border-[var(--ink-900)] transition-colors";

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[var(--fg-3)]">
        {label}
      </label>
      {textarea ? (
        <textarea
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={sharedClassName}
          style={{ resize: "vertical" }}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={sharedClassName}
          style={{ resize: "none" }}
        />
      )}
    </div>
  );
}
