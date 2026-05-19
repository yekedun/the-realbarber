"use client";

import { useState } from "react";
import { formatSlotTime } from "@berber/shared/slot-utils";
import type {
  ServicePublic,
  Slot,
  BookAppointmentResponse,
} from "@berber/shared/types";

interface BookingModalProps {
  shopSlug: string;
  shopName: string;
  staffId: string | null;
  staffName: string;
  service: ServicePublic;
  slot: Slot;
  timezone: string;
  onClose: () => void;
  onSuccess: () => void;
  onConflict: () => void;
}

type Step = "form" | "loading" | "success" | "error";

export function BookingModal({
  shopSlug,
  shopName,
  staffId,
  staffName,
  service,
  slot,
  timezone,
  onClose,
  onSuccess,
  onConflict,
}: BookingModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [isConflict, setIsConflict] = useState(false);
  const [confirmation, setConfirmation] = useState<BookAppointmentResponse | null>(null);

  const timeLabel = formatSlotTime(slot.startsAt, timezone);
  const dateLabel = slot.startsAt.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: timezone,
  });

  const staffLabel = staffId === null ? "Uygun Personel" : staffName;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return;
    if (phone.trim().length < 10) return;
    setStep("loading");
    setErrorMsg("");
    setIsConflict(false);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/widget-book-appointment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({
            shop_slug: shopSlug,
            service_id: service.id,
            staff_id: staffId,
            starts_at: slot.startsAt.toISOString(),
            customer_name: name.trim(),
            customer_phone: phone.trim(),
            customer_notes: note.trim() || undefined,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 || data?.should_refetch_availability) {
          setIsConflict(true);
          const isWorkWindow =
            typeof data?.error === "string" &&
            data.error.includes("calisma saati");
          setErrorMsg(
            isWorkWindow
              ? "Bu saat artık çalışma saatleri dışında. Sayfayı yenileyip güncel saatleri görün."
              : "Bu saat az önce doldu. Lütfen listeden başka bir saat seçin."
          );
          onConflict();
        } else {
          setErrorMsg(data.error ?? "Randevu oluşturulamadı.");
        }
        setStep("error");
        return;
      }
      setConfirmation(data as BookAppointmentResponse);
      setStep("success");
      onSuccess();
    } catch {
      setErrorMsg("Bağlantı hatası. Lütfen tekrar deneyin.");
      setStep("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,23,42,0.45)] p-4 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-[440px] overflow-hidden rounded-lg bg-bgElevated shadow-[0_30px_80px_rgba(15,23,42,0.3)]">
        {step === "form" && (
          <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
            <div className="border-b border-border px-[22px] pb-2 pt-5">
              <h2 className="m-0 text-[20px] font-bold text-ink">Randevuyu Onayla</h2>
              <p className="mt-1.5 text-[13px] text-slate-500">
                {staffLabel} · {service.name} · {dateLabel}, {timeLabel}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 overflow-y-auto p-[22px]">
              <Field label="Ad Soyad">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="örn. Ahmet Yılmaz"
                  required
                  minLength={2}
                  className={inputCls}
                />
              </Field>
              <Field label="Telefon">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0(5xx) xxx xx xx"
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="Not (opsiyonel)">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Saç uzunluğu, tercih, vs."
                  className={`${inputCls} resize-none`}
                />
              </Field>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-md bg-bgSunken py-3.5 text-[14px] font-semibold text-ink"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={name.trim().length < 2 || phone.trim().length < 10}
                  className="flex-[2] rounded-md bg-brand-600 py-3.5 text-[14px] font-semibold text-white shadow-md disabled:opacity-40"
                >
                  Randevuyu Onayla
                </button>
              </div>
            </form>
          </div>
        )}

        {step === "loading" && (
          <div className="flex max-h-[calc(100dvh-2rem)] flex-col items-center overflow-y-auto py-12 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
            <p className="mt-4 text-sm text-slate-500">Randevu oluşturuluyor...</p>
          </div>
        )}

        {step === "success" && confirmation && (
          <div className="flex max-h-[calc(100dvh-2rem)] flex-col items-center overflow-y-auto px-7 py-9 text-center">
            <span className="mb-3 inline-block rounded-full bg-brand-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[1.2px] text-brand-600">
              Onaylandı
            </span>
            <h3 className="m-0 text-[24px] font-bold text-ink">Randevunuz alındı</h3>
            <p className="mt-2 text-[14px] leading-6 text-slate-500">
              {confirmation.staff_name} · {confirmation.service_name}
              <br />
              {new Date(confirmation.starts_at).toLocaleDateString("tr-TR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: timezone,
              })}
              <br />
              <span className="text-slate-400">Onay SMS&apos;i yolda.</span>
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-md bg-bgSunken py-3.5 text-[14px] font-semibold text-ink"
            >
              Yeni randevu
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="flex max-h-[calc(100dvh-2rem)] flex-col items-center overflow-y-auto px-7 py-9 text-center">
            <span className="mb-3 inline-block rounded-full bg-coral-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[1.2px] text-coral-600">
              Hata
            </span>
            <p className="mt-1 text-[14px] text-slate-500">{errorMsg}</p>
            <div className="mt-6 flex w-full gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-md bg-bgSunken py-3.5 text-[14px] font-semibold text-ink"
              >
                {isConflict ? "Saat Seç" : "Kapat"}
              </button>
              {!isConflict && (
                <button
                  onClick={() => setStep("form")}
                  className="flex-1 rounded-md bg-brand-600 py-3.5 text-[14px] font-semibold text-white"
                >
                  Tekrar Dene
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-sm border-[1.5px] border-border bg-bg px-3.5 py-3 text-[14px] text-ink outline-none focus:border-brand-600";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.6px] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
