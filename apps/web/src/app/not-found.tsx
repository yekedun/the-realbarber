export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="max-w-[520px] text-center">
        <div className="mb-2 text-overline font-semibold uppercase tracking-overline text-slate-500">
          404 · SAYFA YOK
        </div>
        <div className="mb-1 text-[96px] font-extrabold leading-none tracking-[-3px] tabular-nums text-brand">
          404
        </div>
        <div className="mx-auto my-5 h-px w-20 bg-border" />
        <h1 className="m-0 mb-2 text-[30px] font-bold tracking-[-0.5px] text-ink">
          Berber Bulunamadı
        </h1>
        <p className="m-0 mb-6 text-[14px] leading-7 text-slate-500">
          Aradığın berber profili artık mevcut değil ya da bağlantı yanlış
          yazılmış olabilir. Ana sayfaya dönüp tekrar deneyebilirsin.
        </p>
        <a
          href="/"
          className="inline-block rounded-md bg-brand px-[22px] py-3.5 text-[14px] font-semibold text-white shadow-md"
        >
          Ana Sayfaya Dön
        </a>
        <div className="mt-7 border-t border-border pt-[18px] text-[11px] font-semibold uppercase tracking-[1.2px] text-slate-400">
          Berber · v1.0.0
        </div>
      </div>
    </main>
  );
}
