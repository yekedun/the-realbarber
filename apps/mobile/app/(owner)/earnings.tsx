/**
 * M7 · Kazanç (Earnings)
 * Pixel-perfect conversion from index.html KazancScreen
 *
 * Includes:
 *  - OverlineHeader: eyebrow "Komisyon", title "Kazanç"
 *  - Period chips: "Bugün" (day), "7 gün" (7), "30 gün" (30)
 *  - Hero KPI card: ink-900 bg, "Tamamlanan Ciro · 30 gün" eyebrow,
 *      84.320 TL large value, "Usta komisyonu" / "Dükkan payı" sub-row
 *  - "Personel Dağılımı" section with 3 staff rows (exact dummy data)
 *      Mehmet Demir  · 58 tamamlanan randevu · Ciro 34.280 TL · Pay 17.140 TL
 *      Can Aslan     · 42 tamamlanan randevu · Ciro 28.120 TL · Pay 14.060 TL
 *      Ayşe Yılmaz   · 22 tamamlanan randevu · Ciro 21.920 TL · Pay 0 TL
 */

import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { estimatedAppointmentRevenueCents } from '../../lib/revenue-mappers';
import { useShop } from '../../lib/ShopContext';

/* ─── Types ─────────────────────────────────────────────────── */

import { formatCents } from '../../lib/utils';

type Period = 'day' | '7' | '30';

/* ─── Chip ──────────────────────────────────────────────────── */

interface ChipProps {
  selected: boolean;
  onPress: () => void;
  children: string;
}

function Chip({ selected, onPress, children }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      activeOpacity={0.75}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}

/* ─── Main Screen ───────────────────────────────────────────── */

export default function EarningsScreen() {
  const { shopId, staffList } = useShop();
  const barberIds = staffList.map(b => b.id);

  const [period, setPeriod] = useState<Period>('30');
  const [periodCiro,     setPeriodCiro]     = useState('—');
  const [periodKomisyon, setPeriodKomisyon] = useState('—');
  const [periodDukkan,   setPeriodDukkan]   = useState('—');
  const [staffDist, setStaffDist] = useState<{ id: string; name: string; appts: number; ciro: string; pay: string }[]>([]);

  const data = {
    label: period === 'day' ? 'Bugün' : period === '7' ? '7 gün' : '30 gün',
    ciro: periodCiro,
    komisyon: periodKomisyon,
    dukkam: periodDukkan,
  };

  useEffect(() => {
    if (!shopId || !barberIds.length) return;
    fetchEarnings();
  }, [period, shopId, barberIds.join(',')]);

  async function fetchEarnings() {
    if (!shopId) return;
    const now = new Date();
    let since: Date;
    if (period === 'day') { since = new Date(now); since.setHours(0,0,0,0); }
    else if (period === '7') { since = new Date(now); since.setDate(now.getDate()-7); }
    else { since = new Date(now); since.setDate(now.getDate()-30); }

    const until = new Date(now); until.setDate(now.getDate()+1); until.setHours(0,0,0,0);

    const { data } = await supabase.rpc('get_shop_appointments_revenue', {
      p_shop_id: shopId,
      p_from: since.toISOString(),
      p_to: until.toISOString(),
      p_staff_ids: barberIds,
    });

    if (data) {
      const totalCiro = data.reduce((s: number, a: any) => s + estimatedAppointmentRevenueCents(a), 0);
      const totalKomisyon = data.reduce((s: number, a: any) => s + (a.completed_commission_cents ?? 0), 0);
      const totalDukkan = data.reduce((s: number, a: any) => s + (a.completed_shop_share_cents ?? 0), 0);
      setPeriodCiro(data.length === 0 ? '—' : formatCents(totalCiro));
      setPeriodKomisyon(data.length === 0 ? '—' : formatCents(totalKomisyon));
      setPeriodDukkan(data.length === 0 ? '—' : formatCents(totalDukkan));

      // Group by barber
      const byBarber: Record<string, { appts: number; ciro: number; pay: number }> = {};
      for (const a of data) {
        if (!byBarber[a.staff_id]) byBarber[a.staff_id] = { appts: 0, ciro: 0, pay: 0 };
        byBarber[a.staff_id].appts += 1;
        byBarber[a.staff_id].ciro += estimatedAppointmentRevenueCents(a);
        byBarber[a.staff_id].pay += a.completed_commission_cents ?? 0;
      }
      // Use staffList from context to label distribution (no extra query)
      if (Object.keys(byBarber).length > 0) {
        setStaffDist(
          staffList
            .filter(b => byBarber[b.id])
            .map(b => ({
              id: b.id,
              name: b.name,
              appts: byBarber[b.id]?.appts ?? 0,
              ciro: formatCents(byBarber[b.id]?.ciro ?? 0) + ' TL',
              pay: formatCents(byBarber[b.id]?.pay ?? 0) + ' TL',
            })),
        );
      } else {
        setStaffDist([]);
      }
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* OverlineHeader */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Komisyon</Text>
        <Text style={styles.pageTitle}>Kazanç</Text>
      </View>

      {/* Period chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {([['day', 'Bugün'], ['7', '7 gün'], ['30', '30 gün']] as [Period, string][]).map(
          ([key, label]) => (
            <Chip key={key} selected={period === key} onPress={() => setPeriod(key)}>
              {label}
            </Chip>
          ),
        )}
      </ScrollView>

      {/* Hero KPI card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>
          Tamamlanan Ciro · {data.label}
        </Text>
        <View style={styles.heroValueRow}>
          <Text style={styles.heroValue}>{data.ciro} </Text>
          <Text style={styles.heroUnit}>TL</Text>
        </View>
        <View style={styles.heroSubRow}>
          <View>
            <Text style={styles.heroSubLabel}>Usta komisyonu</Text>
            <Text style={styles.heroSubValueAmber}>{data.komisyon} TL</Text>
          </View>
          <View>
            <Text style={styles.heroSubLabel}>Dükkan payı</Text>
            <Text style={styles.heroSubValue}>{data.dukkam} TL</Text>
          </View>
        </View>
      </View>

      {/* Section label */}
      <Text style={styles.sectionLabel}>Personel Dağılımı</Text>

      {/* Staff rows */}
      <View style={styles.staffSection}>
        {staffDist.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Henüz veri yok</Text>
          </View>
        )}
        {staffDist.map((p, i) => {
          const initials = p.name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          return (
            <View
              key={p.id}
              style={[styles.staffCard, i < staffDist.length - 1 && { marginBottom: 8 }]}
            >
              {/* Avatar */}
              <View style={styles.staffAvatar}>
                <Text style={styles.staffAvatarText}>{initials}</Text>
              </View>

              {/* Info */}
              <View style={{ flex: 1 }}>
                <Text style={styles.staffName}>{p.name}</Text>
                <Text style={styles.staffMeta}>{p.appts} tamamlanan randevu</Text>
              </View>

              {/* Amounts */}
              <View style={styles.staffAmounts}>
                <Text style={styles.staffPay}>{p.pay}</Text>
                <Text style={styles.staffCiro}>Ciro {p.ciro}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

/* ─── Styles ────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  content: {
    paddingBottom: 40,
  },

  /* Header */
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.slate[500],
  },
  pageTitle: {
    fontSize: 32,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: -0.3,
    color: colors.ink[900],
    marginTop: 10,
  },

  /* Chips */
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.ink[900],
    borderColor: colors.ink[900],
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
  },
  chipTextSelected: {
    color: '#ffffff',
  },

  /* Hero card */
  heroCard: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: colors.ink[900],
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  heroEyebrow: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(245,242,236,0.6)',
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 10,
  },
  heroValue: {
    fontSize: 44,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: -0.88,
    color: '#ffffff',
    lineHeight: 48,
  },
  heroUnit: {
    fontSize: 18,
    fontFamily: 'Montserrat-SemiBold',
    color: '#b3afa5',
    marginBottom: 4,
  },
  heroSubRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,242,236,0.12)',
  },
  heroSubLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
    letterSpacing: 1.96,
    textTransform: 'uppercase',
    color: '#b3afa5',
  },
  heroSubValueAmber: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: colors.umber[100],
    marginTop: 6,
  },
  heroSubValue: {
    fontSize: 18,
    fontFamily: 'Montserrat-Bold',
    color: '#ffffff',
    marginTop: 6,
  },

  /* Section label */
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.slate[500],
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 10,
  },

  /* Staff section */
  staffSection: {
    paddingHorizontal: 20,
  },
  emptyCard: {
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[400],
  },
  staffCard: {
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  staffAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  staffAvatarText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: colors.ink[900],
  },
  staffName: {
    fontSize: 15,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
  },
  staffMeta: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    marginTop: 2,
  },
  staffAmounts: {
    alignItems: 'flex-end',
  },
  staffPay: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: colors.ink[900],
  },
  staffCiro: {
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    marginTop: 2,
  },
});
