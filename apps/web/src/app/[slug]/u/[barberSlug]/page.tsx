import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { BookingFlow } from "../../BookingFlow";
import type { WorkingHours } from "@berber/shared/types";
import type { Database } from "@berber/db/src/database.types";

interface PageProps {
  params: { slug: string; barberSlug: string };
}

export const revalidate = 60;
export const dynamicParams = true;

const getShopBySlug = unstable_cache(
  async (slug: string) => {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("shops")
      .select("id, slug, display_name, bio, avatar_url, timezone, working_hours")
      .eq("slug", slug)
      .single();
    return data;
  },
  ["shop-profile"],
  { revalidate: 60, tags: ["shop-profile"] }
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const shop = await getShopBySlug(params.slug);
  if (!shop) return { title: "Dükkan bulunamadı" };
  const supabase = createSupabaseServerClient();
  const { data: barber } = await supabase
    .from("staff")
    .select("name")
    .eq("shop_id", shop.id)
    .eq("slug", params.barberSlug)
    .single();
  if (!barber) return { title: `${shop.display_name} — Randevu Al` };
  return { title: `${barber.name} · ${shop.display_name} — Randevu Al` };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

export default async function BarberBookingPage({ params }: PageProps) {
  const shop = await getShopBySlug(params.slug);
  if (!shop) notFound();

  const supabase = createSupabaseServerClient();

  const [{ data: services }, { data: allStaff }] = await Promise.all([
    supabase
      .from("services")
      .select("id, shop_id, name, duration_min, price_cents, display_order")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("staff")
      .select("id, shop_id, name, role, slug, is_active")
      .eq("shop_id", shop.id)
      .order("created_at"),
  ]);

  const matched = (allStaff ?? []).find((s) => s.slug === params.barberSlug);
  if (!matched) notFound();

  const activeStaff = (allStaff ?? []).filter((s) => s.is_active);

  const lockedBarber = matched.is_active ? matched : undefined;
  const inactiveBarberName = !matched.is_active ? matched.name : undefined;

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[1080px] px-4 py-8 md:px-6 md:py-12">
        <div className="grid gap-6 md:grid-cols-[380px_minmax(0,1fr)] md:gap-8">
          <ProfileCard
            name={shop.display_name}
            bio={shop.bio}
            avatarUrl={shop.avatar_url}
          />
          <BookingFlow
            shop={{
              id: shop.id,
              slug: shop.slug,
              display_name: shop.display_name,
              bio: shop.bio,
              avatar_url: shop.avatar_url,
              timezone: shop.timezone,
              working_hours: shop.working_hours as unknown as WorkingHours,
            }}
            staff={activeStaff}
            services={services ?? []}
            lockedBarber={lockedBarber}
            inactiveBarberName={inactiveBarberName}
          />
        </div>
      </div>
    </main>
  );
}

function ProfileCard({
  name,
  bio,
  avatarUrl,
}: {
  name: string;
  bio: string | null;
  avatarUrl: string | null;
}) {
  return (
    <aside className="rounded-md border border-border bg-bgElevated p-[22px] shadow-sm md:sticky md:top-8 md:self-start">
      <div className="relative mb-[18px] aspect-[4/3] w-full overflow-hidden rounded-md border border-border">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={name}
            fill
            sizes="380px"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-brand-100">
            <span className="text-[44px] font-bold text-brand">{initials(name)}</span>
          </div>
        )}
      </div>

      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[1.4px] text-danger">
        BERBER · ONLINE RANDEVU
      </div>
      <h1 className="m-0 text-[30px] font-bold leading-tight tracking-[-0.5px] text-ink">
        {name}
      </h1>
      {bio && <p className="mt-1 text-[13px] text-slate-500">{bio}</p>}
    </aside>
  );
}
