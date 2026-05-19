import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "./supabase";

export type UserRole = "owner" | "staff" | null;

interface UserContextValue {
  role: UserRole;
  shopId: string | null;
  staffId: string | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const UserContext = createContext<UserContextValue>({
  role: null,
  shopId: null,
  staffId: null,
  loading: true,
  error: null,
  reload: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [role, setRole]       = useState<UserRole>(null);
  const [shopId, setShopId]   = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [tick, setTick]       = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }

      // Önce dükkan sahibi mi? PGRST116 = no rows, gerçek hata değil.
      const shopRes = await supabase
        .from("shops")
        .select("id")
        .or(`owner_id.eq.${user.id},owner_user_id.eq.${user.id}`)
        .single();
      const shopErr = shopRes.error && shopRes.error.code !== "PGRST116" ? shopRes.error : null;

      if (shopRes.data && !cancelled) {
        setRole("owner");
        setShopId(shopRes.data.id);
        setStaffId(null);
        setLoading(false);
        return;
      }

      // Usta mı?
      const staffRes = await supabase
        .from("staff")
        .select("id, shop_id")
        .eq("user_id", user.id)
        .single();
      const staffErr = staffRes.error && staffRes.error.code !== "PGRST116" ? staffRes.error : null;

      if (!cancelled) {
        if (staffRes.data) {
          setRole("staff");
          setStaffId(staffRes.data.id);
          setShopId(staffRes.data.shop_id);
        } else if (shopErr || staffErr) {
          // Her iki sorgu da gerçek hatayla başarısız → retry edilebilir hata durumu.
          // Ağ kesintisinde role'ü null'da bırakıp sonsuz spinner üretmiyoruz.
          setRole(null);
          setShopId(null);
          setStaffId(null);
          setError((shopErr ?? staffErr)?.message ?? "Profil yüklenemedi");
        } else {
          // Hata yok ama hiçbir profil bulunamadı (auth user'ı henüz tamamlanmamış).
          setRole(null);
          setShopId(null);
          setStaffId(null);
        }
        setLoading(false);
      }
    }
    resolve();
    return () => { cancelled = true; };
  }, [tick]);

  // Oturum değişince yeniden çöz
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      reload();
    });
    return () => subscription.unsubscribe();
  }, [reload]);

  return (
    <UserContext.Provider value={{ role, shopId, staffId, loading, error, reload }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUserRole = () => useContext(UserContext);
