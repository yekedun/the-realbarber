import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';

export interface ServiceOption {
  id: string;
  label: string;
  dur: number;
  price: string;
}

export interface StaffOption {
  id: string;
  name: string;
}

interface ShopState {
  shopId: string | null;
  shopSlug: string | null;
  workingHours: Record<string, unknown> | null;
  services: ServiceOption[];
  staffList: StaffOption[];
  loading: boolean;
  reload: () => void;
}

const ShopContext = createContext<ShopState>({
  shopId: null,
  shopSlug: null,
  workingHours: null,
  services: [],
  staffList: [],
  loading: true,
  reload: () => {},
});

export function ShopProvider({ children }: { children: ReactNode }) {
  const [shopId, setShopId] = useState<string | null>(null);
  const [shopSlug, setShopSlug] = useState<string | null>(null);
  const [workingHours, setWorkingHours] = useState<Record<string, unknown> | null>(null);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }

      const { data: shop } = await supabase
        .from('shops')
        .select('id, slug, working_hours')
        .or(`owner_user_id.eq.${user.id},owner_id.eq.${user.id}`)
        .maybeSingle();
      if (!shop || cancelled) { setLoading(false); return; }

      setShopId(shop.id);
      setShopSlug(shop.slug ?? null);
      setWorkingHours((shop.working_hours as Record<string, unknown> | null) ?? null);

      const [{ data: staff }, { data: svcs }] = await Promise.all([
        supabase.from('staff').select('id, name').eq('shop_id', shop.id).eq('is_active', true),
        supabase.from('services').select('id, name, duration_min, price_cents').eq('shop_id', shop.id).eq('is_active', true),
      ]);

      if (!cancelled) {
        setStaffList(
          (staff ?? []).map(s => ({ id: s.id, name: s.name ?? '' }))
        );
        setServices(
          (svcs ?? []).map((s) => ({
            id: s.id,
            label: s.name ?? '',
            dur: s.duration_min ?? 30,
            price: `${Math.round((s.price_cents ?? 0) / 100)}₺`,
          })),
        );
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tick]);

  return (
    <ShopContext.Provider
      value={{ shopId, shopSlug, workingHours, services, staffList, loading, reload: () => setTick(t => t + 1) }}
    >
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  return useContext(ShopContext);
}
