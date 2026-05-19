"use client";

import { useState } from "react";
import { WebField } from "./WebField";

export type ModalState = "form" | "loading" | "success" | "error";

interface BookingModalShellProps {
  open: boolean;
  onClose: () => void;
  state: ModalState;
  summary?: string;
  onConfirm?: (data: { name: string; phone: string; note: string }) => void;
}

export function BookingModalShell({
  open,
  onClose,
  state,
  summary,
  onConfirm,
}: BookingModalShellProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-[rgba(11,18,32,0.45)] backdrop-blur-[6px] flex items-center justify-center z-[1000] p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--bg-elevated)] rounded-[18px] w-full max-w-[460px] shadow-[0_8px_32px_rgba(11,18,32,0.18)] border border-[var(--border)] overflow-hidden"
      >
        {state === "form" && (
          <div className="p-7">
            <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[var(--fg-3)]">
              Onaylama
            </span>
            <h2 className="text-2xl font-bold tracking-[-0.018em] mt-2">Randevuyu Onayla</h2>
            {summary && <div className="text-[13px] text-[var(--fg-3)] mt-1.5">{summary}</div>}
            <div className="flex flex-col gap-3.5 mt-[22px]">
              <WebField label="Ad Soyad" value={name} onChange={setName} placeholder="örn. Ahmet Yılmaz" />
              <WebField label="Telefon" value={phone} onChange={setPhone} placeholder="0(5xx) xxx xx xx" />
              <WebField label="Not (opsiyonel)" value={note} onChange={setNote} placeholder="Saç uzunluğu, tercih, vs." textarea />
            </div>
            <div className="flex gap-2.5 mt-6">
              <button
                onClick={onClose}
                className="flex-1 h-12 rounded-[12px] border-[1.5px] border-[var(--border)] bg-transparent font-semibold text-[14px] text-[var(--fg-2)] cursor-pointer hover:bg-[var(--bg-sunken)] transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => onConfirm?.({ name, phone, note })}
                disabled={!name || name.length < 2}
                className="flex-[1.5] h-12 rounded-[12px] border-0 font-semibold text-[14px] text-white cursor-pointer disabled:cursor-not-allowed transition-colors disabled:bg-[var(--slate-300)] bg-[var(--ink-900)] hover:enabled:bg-[var(--ink-800)]"
              >
                Randevuyu Onayla
              </button>
            </div>
          </div>
        )}

        {state === "loading" && (
          <div className="p-[60px] text-center">
            <div className="w-9 h-9 mx-auto border-[3px] border-[var(--slate-200)] border-t-[var(--brand-600)] rounded-full animate-spin" />
            <div className="mt-[18px] text-[14px] text-[var(--fg-3)]">Randevu oluşturuluyor…</div>
          </div>
        )}

        {state === "success" && (
          <div className="p-7">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[var(--mint-600)] text-white flex items-center justify-center font-bold text-base shrink-0">
                ✓
              </div>
              <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[var(--mint-700)]">
                Onaylandı
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-[-0.018em] mt-3.5">Randevunuz alındı</h2>
            {summary && <div className="text-[14px] text-[var(--fg-3)] mt-2">{summary}</div>}
            <div className="bg-[var(--bg-sunken)] rounded-[12px] px-4 py-3.5 mt-[18px] text-[13px] text-[var(--fg-2)]">
              Onay SMS&apos;i yolda.
            </div>
            <button
              onClick={onClose}
              className="mt-[22px] w-full h-12 rounded-[12px] border-0 bg-[var(--ink-900)] text-white font-semibold text-[14px] cursor-pointer hover:bg-[var(--ink-800)] transition-colors"
            >
              Yeni randevu
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="p-7">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[var(--coral-600)] text-white flex items-center justify-center font-bold text-base shrink-0">
                !
              </div>
              <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[var(--coral-700)]">
                Hata
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-[-0.018em] mt-3.5">Bu saat az önce doldu.</h2>
            <div className="text-[14px] text-[var(--fg-3)] mt-2">
              Lütfen listeden başka bir saat seçin.
            </div>
            <button
              onClick={onClose}
              className="mt-[22px] w-full h-12 rounded-[12px] border-0 bg-[var(--ink-900)] text-white font-semibold text-[14px] cursor-pointer hover:bg-[var(--ink-800)] transition-colors"
            >
              Saat Seç
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
