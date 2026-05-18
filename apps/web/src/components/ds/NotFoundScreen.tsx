import { Button } from "./Button";

interface NotFoundScreenProps {
  onHome?: () => void;
}

export function NotFoundScreen({ onHome }: NotFoundScreenProps) {
  return (
    <div className="min-h-[480px] flex flex-col items-center justify-center text-center px-16 py-[60px] gap-4">
      <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[var(--fg-3)]">
        404 · Sayfa Yok
      </span>
      <div className="text-[88px] font-bold tracking-[-0.04em] leading-[0.95] text-[var(--ink-900)]">
        404
      </div>
      <h1 className="text-[28px] font-bold tracking-[-0.02em]">Berber Bulunamadı</h1>
      <p className="text-[15px] text-[var(--fg-2)] max-w-[420px] leading-[1.55]">
        Aradığın berber profili artık mevcut değil ya da bağlantı yanlış yazılmış olabilir.
        Ana sayfaya dönüp tekrar deneyebilirsin.
      </p>
      <Button variant="primary" size="md" className="mt-3" onClick={onHome}>
        Ana Sayfaya Dön
      </Button>
    </div>
  );
}
