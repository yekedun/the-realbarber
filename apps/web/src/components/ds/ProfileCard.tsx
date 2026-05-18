interface ProfileCardProps {
  name: string;
  slug: string;
  bio?: string;
  rating?: string;
  avgService?: string;
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0] ?? "").join("").slice(0, 2).toUpperCase();
}

export function ProfileCard({ name, slug, bio, rating, avgService }: ProfileCardProps) {
  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[18px] p-7 shadow-[0_1px_3px_rgba(11,18,32,0.06)]">
      <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[var(--fg-3)]">
        Berber · Online Randevu
      </span>
      <div className="flex items-center gap-4 mt-[18px]">
        <div className="w-[60px] h-[60px] rounded-full bg-[var(--brand-600)] text-white flex items-center justify-center font-bold text-[22px] shrink-0">
          {initials(name)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold tracking-[-0.018em]">{name}</h2>
          <div className="text-[13px] text-[var(--fg-3)] mt-1 font-mono">siradaki.app/{slug}</div>
        </div>
      </div>
      {bio && (
        <p className="text-[15px] text-[var(--fg-2)] leading-[1.55] mt-[18px]">{bio}</p>
      )}
      {(avgService || rating) && (
        <div className="flex gap-6 mt-[18px] pt-[18px] border-t border-[var(--divider)]">
          {avgService && (
            <div>
              <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--fg-3)]">Ortalama Süre</div>
              <div className="text-[15px] font-semibold mt-1.5 tabular-nums">{avgService}</div>
            </div>
          )}
          {rating && (
            <div>
              <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[var(--fg-3)]">Puan</div>
              <div className="text-[15px] font-semibold mt-1.5 tabular-nums">{rating}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
