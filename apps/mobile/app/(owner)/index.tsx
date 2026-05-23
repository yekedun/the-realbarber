/**
 * M3 · Özet / KPI Polish
 * Source: screen-20-ajanda-v2.html — OzetKpiPolished()
 *         screens.jsx — OzetScreen()
 *
 * OverlineHeader: eyebrow="Dükkan Özet" title="Bugün" meta="20 Mayıs 2026, Çar"
 *
 * ChipRow (gap:8, padding:'4px 20px 4px'):
 *   Tüm Ekip (12) · Mehmet (5) · Can (4) · Ayşe (3)
 *
 * KPI row — gap:8, padding:'14px 16px 0':
 *   1. label="Toplam"     value="12"    trend=+8%  spark=[7,9,8,10,7,11,12]
 *   2. label="Tamamlanan" value="8"     trend=+5%  progress=8/12
 *   3. label="Tahmini"    value="2.840" unit="₺"  trend=+12% spark=[2100,2300,2200,2650,2480,2840] accent
 *
 * KpiPolished card (source):
 *   flex:1 minWidth:0 borderRadius:14 padding:'13px 13px 11px'
 *   label: 9px bold 0.18em uppercase
 *   value: 28px bold tabular-nums -0.025em
 *   unit:  10px semiBold marginLeft:2 0.06em
 *   trend pill: 10px bold borderRadius:999 padding:'2px 7px'
 *     up: mint-100 bg, mint-700 text (dark: rgba bg, rgba(0,255,180,0.75) text)
 *     dn: coral-100 bg, coral-700 text (dark: rgba bg, rgba(255,120,100,0.8) text)
 *   accent (dark): ink-900 bg, ink-700 border, shadow '0 8px 24px -8px rgba(11,18,32,0.55)'
 *   default:        slate-0 bg, slate-200 border, shadow '0 1px 3px rgba(11,18,32,0.05)'
 *
 * Sparkline: w=54 h=28, polyline, barColor= dark?rgba(255,255,255,0.55):brand-500
 * RingProgress: size=30, r=(30-5)/2=12.5, circ≈78.5, strokeWidth=3
 *   fg= dark?#fff:brand-600, bg= dark?rgba(255,255,255,0.12):slate-100
 *
 * SectionLabel "Öngörüler (30 gün)":
 *   Card padding=0, two rows padding:'13px 16px':
 *     En Çok Tercih Edilen / Saç + Sakal / %34
 *     En Yoğun Gün / Cumartesi / 32 randevu
 *   row divider: borderBottom:'1px solid var(--slate-100)'
 *
 * SectionLabel "Usta Bazında":
 *   Cards padding=12, gap=8, padding:'0 16px'
 *   Each: avatar 34×34 borderRadius:999 (brand-600/umber-600/mint-700),
 *     name 14px semiBold, meta 11px fg-3,
 *     mini bar: count 12px bold, track 36×3 borderRadius:2
 *
 * ScrollView + RefreshControl
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { colors } from '../../lib/theme';
import { OverlineHeader } from '../../components/ds/OverlineHeader';
import { SectionLabel } from '../../components/ds/SectionLabel';
import { Chip } from '../../components/ds/Chip';

// TODO: connect Supabase — replace with get_owner_summary RPC

/** Chip list — populated from Supabase once connected */
const STAFF: { id: string; name: string }[] = [
  { id: 'all', name: 'Tüm Ekip' },
];

/* ── Sparkline (bar-chart approximation in RN) ──────────────── */
function Sparkline({ data, dark }: { data: number[]; dark: boolean }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const rng = max - min || 1;
  const barColor = dark ? 'rgba(255,255,255,0.55)' : colors.brand[500];
  const W = 54;
  const H = 28;
  const n = data.length;
  const gap = 2;
  const barW = (W - (n - 1) * gap) / n;

  return (
    <View style={{ width: W, height: H, flexDirection: 'row', alignItems: 'flex-end', gap, flexShrink: 0 }}>
      {data.map((v, i) => {
        const heightRatio = ((v - min) / rng) * 0.78 + 0.08;
        return (
          <View
            key={i}
            style={{
              width: barW,
              height: H * heightRatio,
              borderRadius: 1,
              backgroundColor: barColor,
              opacity: i === n - 1 ? 1 : 0.45 + (i / n) * 0.35,
            }}
          />
        );
      })}
    </View>
  );
}

/* ── RingProgress ────────────────────────────────────────────── */
function RingProgress({ value, max, dark }: { value: number; max: number; dark: boolean }) {
  const pct   = value / max;
  const ringFg = dark ? '#ffffff' : colors.brand[600];
  const ringBg = dark ? 'rgba(255,255,255,0.12)' : colors.slate[100];
  return (
    <View style={{ width: 30, height: 30, flexShrink: 0 }}>
      {/* Background ring */}
      <View style={[rp.ring, { borderColor: ringBg }]} />
      {/* Progress — simplified quadrant technique */}
      <View
        style={[
          rp.ring,
          {
            borderColor: ringFg,
            borderBottomColor: pct < 0.25 ? 'transparent' : ringFg,
            borderLeftColor:   pct < 0.5  ? 'transparent' : ringFg,
            transform: [{ rotate: '-90deg' }],
          },
        ]}
      />
    </View>
  );
}

const rp = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: 'transparent',
  },
});

/* ── KpiPolished ─────────────────────────────────────────────── */
interface KpiPolishedProps {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
  spark?: number[];
  progress?: number;
  max?: number;
}

function KpiPolished({
  label,
  value,
  unit,
  accent = false,
  spark,
  progress,
  max,
}: KpiPolishedProps) {
  const dark = accent;
  const bg     = dark ? colors.ink[900]              : colors.slate[0];
  const fg     = dark ? '#ffffff'                    : colors.ink[900];
  const sub    = dark ? 'rgba(255,255,255,0.5)'      : colors.slate[500];
  const borCol = dark ? colors.ink[700]              : colors.slate[200];

  return (
    <View style={[kpi.card, { backgroundColor: bg, borderColor: borCol }]}>
      {/* Label — 9px bold 0.18em uppercase */}
      <Text style={[kpi.label, { color: sub }]}>{label}</Text>

      {/* Value row */}
      <View style={kpi.valueRow}>
        <View style={{ minWidth: 0, flex: 1 }}>
          {/* Value + unit */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text
              style={[kpi.value, { color: fg }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {value}
            </Text>
            {unit ? <Text style={[kpi.unit, { color: sub }]}>{unit}</Text> : null}
          </View>
        </View>
        {/* Sparkline or Ring — right side */}
        {spark && <Sparkline data={spark} dark={dark} />}
        {progress !== undefined ? (
          <RingProgress value={progress} max={max ?? 1} dark={dark} />
        ) : null}
      </View>
    </View>
  );
}

const kpi = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 14,
    paddingTop: 13,
    paddingHorizontal: 13,
    paddingBottom: 11,
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  label: {
    fontSize: 9,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 1.62,           // 0.18em × 9
    textTransform: 'uppercase',
    lineHeight: 9,
  },
  valueRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
  },
  value: {
    fontSize: 28,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: -0.7,           // -0.025em × 28
    lineHeight: 28,
  },
  unit: {
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
    marginLeft: 2,
    letterSpacing: 0.6,            // 0.06em × 10
    marginBottom: 2,
  },
});

/* ── Main Screen ─────────────────────────────────────────────── */
export default function OzetScreen() {
  const [filter,     setFilter]     = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    // TODO: connect Supabase — refetch today's summary
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* OverlineHeader — padding:'8px 20px 16px' */}
      <OverlineHeader
        eyebrow="Dükkan Özet"
        title="Bugün"
        meta="20 Mayıs 2026, Çar"
      />

      {/* ChipRow — gap:8, padding:'4px 20px 4px', overflowX:auto */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContent}
      >
        {STAFF.map(s => (
          <Chip key={s.id} selected={filter === s.id} onPress={() => setFilter(s.id)}>
            {s.name}
          </Chip>
        ))}
      </ScrollView>

      {/* KPI row — gap:8, padding:'14px 16px 0' */}
      <View style={styles.kpiRow}>
        <KpiPolished
          label="Toplam"
          value="—"
        />
        <KpiPolished
          label="Tamamlanan"
          value="—"
        />
        <KpiPolished
          label="Tahmini"
          value="—"
          unit="₺"
          accent
        />
      </View>

      {/* Öngörüler section — TODO: connect Supabase */}
      <SectionLabel>Öngörüler (30 gün)</SectionLabel>
      <View style={styles.insightsCard}>
        <View style={[styles.insightRow, styles.insightBorder]}>
          <View>
            <Text style={styles.insightRowLabel}>En Çok Tercih Edilen</Text>
            <Text style={styles.insightRowValue}>—</Text>
          </View>
          <Text style={styles.insightRowRight}>—</Text>
        </View>
        <View style={styles.insightRow}>
          <View>
            <Text style={styles.insightRowLabel}>En Yoğun Gün</Text>
            <Text style={styles.insightRowValue}>—</Text>
          </View>
          <Text style={styles.insightRowRight}>—</Text>
        </View>
      </View>

      {/* Usta Bazında — TODO: connect Supabase */}
      <SectionLabel>Usta Bazında</SectionLabel>
      <View style={styles.staffList}>
        <View style={[styles.insightsCard, { marginHorizontal: 0, paddingVertical: 16, alignItems: 'center' }]}>
          <Text style={{ fontSize: 13, fontFamily: 'Montserrat-Regular', color: colors.slate[400] }}>
            Henüz veri yok
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.slate[50] },
  content: { paddingBottom: 24 },

  /* ChipRow — padding:'4px 20px' */
  chipScroll:  {},
  chipContent: { gap: 8, paddingHorizontal: 20, paddingVertical: 4 },

  /* KPI row — gap:8, padding:'14px 16px 0' */
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  /* Insights card — padding:'0 16px' → marginH:16 */
  insightsCard: {
    marginHorizontal: 16,
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 12,
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },
  insightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  insightBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  insightRowLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-SemiBold',
    letterSpacing: 1.4,            // 0.14em × 10
    textTransform: 'uppercase',
    color: colors.slate[500],
  },
  insightRowValue: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
    marginTop: 4,
  },
  insightRowRight: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
  },

  /* Staff list — gap:8, padding:'0 16px' */
  staffList: { gap: 8, paddingHorizontal: 16 },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 12,
    padding: 12,
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },

  /* Avatar — 34×34 borderRadius:999 */
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: '#ffffff',
  },

  staffInfo:  { flex: 1 },
  staffName: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
  },
  staffMeta: {
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    marginTop: 2,
  },

  /* Mini bar — width:36, gap:3, alignItems:'flex-end' */
  miniBarWrap: { width: 36, alignItems: 'flex-end', gap: 3 },
  miniCount: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
  },
  miniTrack: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.slate[100],
    overflow: 'hidden',
  },
  miniFill: {
    height: '100%',
    borderRadius: 2,
  },
});
