"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type {
  ShopPublic,
  StaffPublic,
  ServicePublic,
  Slot,
} from "@berber/shared/types";
import { ServiceSelector } from "@/components/ServiceSelector";
import { SlotGrid } from "@/components/SlotGrid";
import { BookingModal } from "@/components/BookingModal";

interface BookingFlowProps {
  shop: ShopPublic;
  staff: StaffPublic[];
  services: ServicePublic[];
}

type StaffSelection = StaffPublic | "any";

interface SlotItem {
  starts_at: string;
  ends_at: string;
  available: boolean;
}

const TR_DAY_SHORT = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const TR_MONTH = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function ymd(d: Date): string {
  return d.toISOString().split("T")[0]!;
}
function isSameYMD(a: Date, b: Date): boolean {
  return ymd(a) === ymd(b);
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("");
}

export function BookingFlow({ shop, staff, services }: BookingFlowProps) {
  const [selectedService, setSelectedService]     = useState<ServicePublic | null>(null);
  const [selectedStaff, setSelectedStaff]         = useState<StaffSelection | null>(null);
  const [selectedDate, setSelectedDate]           = useState<string>(() => ymd(new Date()));
  const [serverSlots, setServerSlots]             = useState<SlotItem[]>([]);
  const [selectedSlot, setSelectedSlot]           = useState<Slot | null>(null);
  const [isLoadingSlots, setIsLoadingSlots]       = useState(false);
  const [confirmOpen, setConfirmOpen]             = useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const selectedStaffId = selectedStaff === null
    ? null
    : selectedStaff === "any"
    ? "any"
    : selectedStaff.id;

  // Slot'ları sunucudan çek
  const fetchSlots = useCallback(() => {
    if (!selectedService || selectedStaffId === null) return;
    let cancelled = false;
    setIsLoadingSlots(true);
    const params = new URLSearchParams({
      shop_slug:  shop.slug,
      slug:       shop.slug,
      date:       selectedDate,
      service_id: selectedService.id,
      staff_id:   selectedStaffId ?? "",
    });
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-availability?${params}`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
    })
      .then((r) => r.json())
      .then((data: { slots: SlotItem[] }) => {
        if (cancelled) return;
        setServerSlots(data.slots ?? []);
      })
      .catch(() => { if (!cancelled) setServerSlots([]); })
      .finally(() => { if (!cancelled) setIsLoadingSlots(false); });
    return () => { cancelled = true; };
  }, [selectedService, selectedStaffId, selectedDate, shop.slug]);

  useEffect(() => {
    const cleanup = fetchSlots();
    return cleanup;
  }, [fetchSlots]);

  // selectedSlot'u slot listesi değişince sıfırla
  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedService, selectedStaff, selectedDate]);

  // Realtime: slot değişince yeniden çek
  useEffect(() => {
    if (!selectedService || selectedStaffId === null) return;

    // Hangi usta ID'lerine subscribe olacağız?
    const targetStaffIds =
      selectedStaffId === "any"
        ? staff.map((b) => b.id)
        : [selectedStaffId];

    const channel = supabase.channel(`slots:${shop.id}:${selectedStaffId}`);

    for (const bid of targetStaffIds) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_slots", filter: `staff_id=eq.${bid}` },
        () => fetchSlots()
      );
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "block_slots", filter: `staff_id=eq.${bid}` },
        () => fetchSlots()
      );
    }

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedStaffId, selectedService, staff, shop.id, supabase, fetchSlots]);

  // serverSlots → Slot[]
  const slots: Slot[] = useMemo(
    () =>
      serverSlots.map((s) => ({
        startsAt:  new Date(s.starts_at),
        endsAt:    new Date(s.ends_at),
        available: s.available,
      })),
    [serverSlots]
  );

  const handleBookingSuccess = useCallback(() => {
    setSelectedSlot(null);
    setConfirmOpen(false);
    fetchSlots();
  }, [fetchSlots]);

  const handleBookingConflict = useCallback(() => {
    setSelectedSlot(null);
    fetchSlots();
  }, [fetchSlots]);

  const today = new Date();
  const dateOptions = useMemo(
    () => Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    }),
    []
  );

  const slotTime = selectedSlot
    ? selectedSlot.startsAt.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: shop.timezone,
      })
    : null;

  return (
    <div className="flex flex-col gap-7">

      {/* Adım 1: Hizmet */}
      <Section step={1} title="Hizmet Seç">
        <ServiceSelector
          services={services}
          selected={selectedService}
          onSelect={(s) => {
            setSelectedService(s);
            setSelectedStaff(null);
          }}
        />
      </Section>

      {/* Adım 2: Usta */}
      {selectedService && (
        <Section step={2} title="Usta Seç">
          <div className="flex flex-wrap gap-2">
            {/* Fark Etmez */}
            <StaffCard
              name="Fark Etmez"
              subtitle="Uygun personele atanır"
              avatarUrl={null}
              selected={selectedStaff === "any"}
              onSelect={() => setSelectedStaff("any")}
              isAny
            />
            {staff.map((s) => (
              <StaffCard
                key={s.id}
                name={s.name}
                avatarUrl={null}
                selected={selectedStaff !== "any" && selectedStaff?.id === s.id}
                onSelect={() => setSelectedStaff(s)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Adım 3: Tarih */}
      {selectedService && selectedStaff !== null && (
        <Section step={3} title="Tarih">
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {dateOptions.map((d) => {
              const sel     = ymd(d) === selectedDate;
              const isToday = isSameYMD(d, today);
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelectedDate(ymd(d))}
                  className={`flex h-[72px] w-14 flex-none flex-col items-center justify-center rounded-cta transition-colors ${
                    sel
                      ? "bg-ink text-white shadow-pill"
                      : isToday
                      ? "border-[1.5px] border-red bg-surface text-ink"
                      : "border border-hair bg-surface text-ink"
                  }`}
                >
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.5px] ${sel ? "text-white/70" : "text-muted"}`}>
                    {TR_DAY_SHORT[d.getDay()]}
                  </span>
                  <span className="text-[20px] font-bold">{d.getDate()}</span>
                  <span className={`text-[9px] ${sel ? "text-white/60" : "text-mutedAlt"}`}>
                    {TR_MONTH[d.getMonth()]!.slice(0, 3)}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Adım 4: Saat */}
      {selectedService && selectedStaff !== null && (
        <Section step={4} title="Saat">
          <SlotGrid
            slots={slots}
            timezone={shop.timezone}
            isLoading={isLoadingSlots}
            selected={selectedSlot}
            onSelect={setSelectedSlot}
          />
          <button
            disabled={!selectedSlot}
            onClick={() => setConfirmOpen(true)}
            className={`mt-5 w-full rounded-cta py-4 text-[15px] font-semibold transition-colors ${
              selectedSlot
                ? "bg-navy text-white shadow-cta"
                : "bg-surfaceAlt text-mutedAlt cursor-not-allowed"
            }`}
          >
            {selectedSlot ? `${slotTime}'da Devam Et` : "Saat Seç"}
          </button>
        </Section>
      )}

      {confirmOpen && selectedSlot && selectedService && (
        <BookingModal
          shopSlug={shop.slug}
          shopName={shop.display_name}
          staffId={selectedStaffId === "any" ? null : (selectedStaffId ?? null)}
          staffName={
            selectedStaff === "any" || selectedStaff === null
              ? "Uygun Personel"
              : selectedStaff.name
          }
          service={selectedService}
          slot={selectedSlot}
          timezone={shop.timezone}
          onClose={() => setConfirmOpen(false)}
          onSuccess={handleBookingSuccess}
          onConflict={handleBookingConflict}
        />
      )}
    </div>
  );
}

function StaffCard({
  name,
  subtitle,
  avatarUrl,
  selected,
  onSelect,
  isAny = false,
}: {
  name: string;
  subtitle?: string;
  avatarUrl: string | null;
  selected: boolean;
  onSelect: () => void;
  isAny?: boolean;
}) {
  function initials(n: string) {
    return n.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("");
  }

  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-cta border px-3.5 py-2.5 transition-colors ${
        selected
          ? "border-navy bg-navy text-white shadow-cta"
          : "border-hair bg-surface text-ink hover:border-navy/40"
      }`}
    >
      {isAny ? (
        <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-full border-2 border-dashed ${selected ? "border-white/50" : "border-hair"}`}>
          <span className={`text-[10px] font-bold ${selected ? "text-white/70" : "text-muted"}`}>?</span>
        </div>
      ) : avatarUrl ? (
        <img src={avatarUrl} alt={name} className="h-8 w-8 flex-none rounded-full object-cover" />
      ) : (
        <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${selected ? "bg-white/20" : "bg-blue-soft"}`}>
          <span className={`text-[11px] font-bold ${selected ? "text-white" : "text-navy"}`}>{initials(name)}</span>
        </div>
      )}
      <div className="text-left">
        <div className="text-[13px] font-semibold leading-tight">{name}</div>
        {subtitle && (
          <div className={`text-[11px] ${selected ? "text-white/60" : "text-muted"}`}>{subtitle}</div>
        )}
      </div>
    </button>
  );
}

function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-hair bg-surface p-[22px] shadow-card">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">
          {step}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.6px] text-muted">
          {title}
        </span>
      </div>
      {children}
    </section>
  );
}
