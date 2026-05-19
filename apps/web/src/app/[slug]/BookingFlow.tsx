"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRealtimeInvalidation } from "@berber/shared/use-realtime-invalidation";
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
import { Card, StepHeader, StaffPicker, DateRail, BookButton } from "@/components/ds";

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

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as AvailabilityResponse;
        if (!res.ok) throw new Error(data.error || "Müsaitlik bilgisi alınamadı.");
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
      .finally(() => { if (!cancelled) setIsLoadingSlots(false); });

    return () => { cancelled = true; };
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
    () => serverSlots.map((s) => ({
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

  // DateRail bridge: index ↔ YYYY-MM-DD
  const today = useMemo(() => new Date(), []);
  const dateOptions = useMemo(
    () => Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    }),
    [today]
  );
  const selectedDateIndex = useMemo(
    () => Math.max(0, dateOptions.findIndex((d) => localYmd(d) === selectedDate)),
    [dateOptions, selectedDate]
  );

  // StaffPicker bridge: StaffPublic | "any" | null ↔ string | null
  const staffPickerSelected = useMemo(
    () => selectedStaff === null ? null : selectedStaff === "any" ? "any" : (selectedStaff as StaffPublic).id,
    [selectedStaff]
  );
  const handleStaffSelect = useCallback((id: string) => {
    if (id === "any") {
      setSelectedStaff("any");
      setReferralDismissed(true);
    } else {
      const found = staff.find((s) => s.id === id) ?? null;
      setSelectedStaff(found);
      if (lockedBarber && found?.id !== lockedBarber.id) setReferralDismissed(true);
    }
  }, [staff, lockedBarber]);

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
    <div className="flex flex-col gap-5">
      {inactiveBarberName && (
        <div className="rounded-md border border-umber-100 bg-umber-100/60 px-4 py-3 text-[13px] text-umber-600">
          <strong>{inactiveBarberName}</strong> artık bu dükkanda çalışmıyor. Başka bir usta seçebilirsin.
        </div>
      )}
      {showReferralBadge && (
        <div className="flex items-center gap-2 rounded-md border border-brand-600/20 bg-brand-100 px-3 py-2 text-[12px] text-brand-600">
          <span>🔒</span>
          <span className="font-medium">{lockedBarber.name}&apos;in linkinden geldin</span>
          <button
            onClick={() => setReferralDismissed(true)}
            className="ml-auto text-[10px] text-slate-500 hover:text-ink"
          >
            ✕
          </button>
        </div>
      )}

      {/* Step 1 — Service */}
      <Card className="p-[22px]">
        <div className="mb-4">
          <StepHeader num={1} title="Hizmet Seç" status={selectedService ? "done" : "active"} />
        </div>
        <ServiceSelector
          services={services}
          selected={selectedService}
          onSelect={(service) => {
            setSelectedService(service);
            if (!lockedBarber) setSelectedStaff(null);
          }}
        />
      </Card>

      {/* Step 2 — Staff */}
      {selectedService && (
        <Card className="p-[22px]">
          <div className="mb-4">
            <StepHeader num={2} title="Usta Seç" status={selectedStaff !== null ? "done" : "active"} />
          </div>
          <StaffPicker
            staff={staff.map((s) => ({ id: s.id, name: s.name }))}
            selected={staffPickerSelected}
            onSelect={handleStaffSelect}
          />
        </Card>
      )}

      {/* Step 3 — Date */}
      {selectedService && selectedStaff !== null && (
        <Card className="p-[22px]">
          <div className="mb-4">
            <StepHeader num={3} title="Tarih" status={selectedSlot ? "done" : "active"} />
          </div>
          <DateRail
            selected={selectedDateIndex}
            onSelect={(i) => setSelectedDate(localYmd(dateOptions[i]!))}
            days={14}
            startDate={today}
          />
        </Card>
      )}

      {/* Step 4 — Slot */}
      {selectedService && selectedStaff !== null && (
        <Card className="p-[22px]">
          <div className="mb-4">
            <StepHeader num={4} title="Saat" status={selectedSlot ? "done" : "active"} />
          </div>
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
          <div className="mt-5">
            <BookButton
              time={slotTime}
              disabled={!selectedSlot || Boolean(slotError)}
              onClick={() => setConfirmOpen(true)}
            />
          </div>
        </Card>
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
