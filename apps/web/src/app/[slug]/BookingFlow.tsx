"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRealtimeInvalidation } from "@berber/shared/use-realtime-invalidation";
import Image from "next/image";
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
  lockedBarber?: StaffPublic;
  inactiveBarberName?: string;
}

type StaffSelection = StaffPublic | "any";

interface SlotItem {
  starts_at: string;
  ends_at: string;
  available: boolean;
}

interface AvailabilityResponse {
  slots?: SlotItem[];
  closed?: boolean;
  error?: string;
}

const TR_DAY_SHORT = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const TR_MONTH = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isSameYMD(a: Date, b: Date): boolean {
  return localYmd(a) === localYmd(b);
}

export function BookingFlow({ shop, staff, services, lockedBarber, inactiveBarberName }: BookingFlowProps) {
  const [selectedService, setSelectedService] = useState<ServicePublic | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffSelection | null>(() => lockedBarber ?? null);
  const [referralDismissed, setReferralDismissed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => localYmd(new Date()));
  const [serverSlots, setServerSlots] = useState<SlotItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const selectedStaffId = selectedStaff === null
    ? null
    : selectedStaff === "any"
    ? "any"
    : selectedStaff.id;

  const fetchSlots = useCallback(() => {
    if (!selectedService || selectedStaffId === null) return;
    let cancelled = false;
    setIsLoadingSlots(true);
    setSlotError(null);

    const params = new URLSearchParams({
      shop_slug: shop.slug,
      slug: shop.slug,
      date: selectedDate,
      service_id: selectedService.id,
      staff_id: selectedStaffId ?? "",
    });

    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-availability?${params}`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as AvailabilityResponse;
        if (!res.ok) {
          throw new Error(data.error || "Müsaitlik bilgisi alınamadı.");
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setServerSlots(data.slots ?? []);
        setIsClosed(Boolean(data.closed));
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setServerSlots([]);
        setIsClosed(false);
        setSlotError(err.message || "Müsaitlik bilgisi alınamadı.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedService, selectedStaffId, selectedDate, shop.slug]);

  useEffect(() => {
    const cleanup = fetchSlots();
    return cleanup;
  }, [fetchSlots]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedService, selectedStaff, selectedDate]);

  const targetStaffIds = useMemo(() =>
    selectedStaffId === "any"
      ? staff.map((b) => b.id)
      : selectedStaffId
      ? [selectedStaffId]
      : [],
    [selectedStaffId, staff]
  );

  const bookingTableFilters = useMemo(() => [
    { table: "appointment_slots" as const, filters: targetStaffIds.map(id => `staff_id=eq.${id}`) },
    { table: "block_slots" as const,       filters: targetStaffIds.map(id => `staff_id=eq.${id}`) },
  ], [targetStaffIds]);

  useRealtimeInvalidation({
    client: supabase,
    channelName: `slots:${shop.id}:${selectedStaffId ?? "none"}`,
    tableFilters: bookingTableFilters,
    invalidate: fetchSlots,
    enabled: !!selectedService && selectedStaffId !== null,
  });

  const slots: Slot[] = useMemo(
    () =>
      serverSlots.map((s) => ({
        startsAt: new Date(s.starts_at),
        endsAt: new Date(s.ends_at),
        available: s.available,
      })),
    [serverSlots]
  );

  const handleBookingSuccess = useCallback(() => {
    setSelectedSlot(null);
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

  const showReferralBadge =
    lockedBarber != null &&
    !referralDismissed &&
    selectedStaff !== "any" &&
    (selectedStaff as StaffPublic | null)?.id === lockedBarber.id;

  return (
    <div className="flex flex-col gap-7">
      {inactiveBarberName && (
        <div className="rounded-cta border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          <strong>{inactiveBarberName}</strong> artık bu dükkanda çalışmıyor. Başka bir usta seçebilirsin.
        </div>
      )}
      {showReferralBadge && (
        <div className="flex items-center gap-2 rounded-cta border border-navy/20 bg-blue-soft px-3 py-2 text-[12px] text-navy">
          <span>🔒</span>
          <span className="font-medium">{lockedBarber.name}&apos;in linkinden geldin</span>
          <button
            onClick={() => setReferralDismissed(true)}
            className="ml-auto text-[10px] text-muted hover:text-ink"
          >
            ✕
          </button>
        </div>
      )}
      <Section step={1} title="Hizmet Seç">
        <ServiceSelector
          services={services}
          selected={selectedService}
          onSelect={(service) => {
            setSelectedService(service);
            if (!lockedBarber) setSelectedStaff(null);
          }}
        />
      </Section>

      {selectedService && (
        <Section step={2} title="Usta Seç">
          <div className="flex flex-wrap gap-2">
            <StaffCard
              name="Fark Etmez"
              subtitle="Uygun personele atanır"
              avatarUrl={null}
              selected={selectedStaff === "any"}
              onSelect={() => { setSelectedStaff("any"); setReferralDismissed(true); }}
              isAny
            />
            {staff.map((staffMember) => (
              <StaffCard
                key={staffMember.id}
                name={staffMember.name}
                avatarUrl={null}
                selected={selectedStaff !== "any" && (selectedStaff as StaffPublic | null)?.id === staffMember.id}
                onSelect={() => {
                  setSelectedStaff(staffMember);
                  if (lockedBarber && staffMember.id !== lockedBarber.id) setReferralDismissed(true);
                }}
              />
            ))}
          </div>
        </Section>
      )}

      {selectedService && selectedStaff !== null && (
        <Section step={3} title="Tarih">
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {dateOptions.map((date) => {
              const selected = localYmd(date) === selectedDate;
              const isToday = isSameYMD(date, today);
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(localYmd(date))}
                  className={`flex h-[72px] w-14 flex-none flex-col items-center justify-center rounded-cta transition-colors ${
                    selected
                      ? "bg-ink text-white shadow-pill"
                      : isToday
                      ? "border-[1.5px] border-red bg-surface text-ink"
                      : "border border-hair bg-surface text-ink"
                  }`}
                >
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.5px] ${selected ? "text-white/70" : "text-muted"}`}>
                    {TR_DAY_SHORT[date.getDay()]}
                  </span>
                  <span className="text-[20px] font-bold">{date.getDate()}</span>
                  <span className={`text-[9px] ${selected ? "text-white/60" : "text-mutedAlt"}`}>
                    {TR_MONTH[date.getMonth()]!.slice(0, 3)}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {selectedService && selectedStaff !== null && (
        <Section step={4} title="Saat">
          <SlotGrid
            slots={slots}
            timezone={shop.timezone}
            isLoading={isLoadingSlots}
            selected={selectedSlot}
            onSelect={setSelectedSlot}
            errorMessage={slotError}
            isClosed={isClosed}
            onRetry={fetchSlots}
          />
          <button
            disabled={!selectedSlot || Boolean(slotError)}
            onClick={() => setConfirmOpen(true)}
            className={`mt-5 w-full rounded-cta py-4 text-[15px] font-semibold transition-colors ${
              selectedSlot && !slotError
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
        <Image
          src={avatarUrl}
          alt={name}
          width={32}
          height={32}
          className="h-8 w-8 flex-none rounded-full object-cover"
        />
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
