/**
 * M10 — Staff: Blok / Takvimi Kapat screen
 * Source: screens.jsx → BlokScreen
 *
 * Form state layout:
 *   height: '100%', overflowY: 'auto', paddingBottom: 100, flexCol
 *   OverlineHeader eyebrow="Blok Ekle" title="Takvimi Kapat"
 *     meta="Şu andan itibaren seçtiğin süre boyunca takvim kapalı görünür."
 *   Card (padding 16):
 *     overline "Şu An · 10:42"  (11px SemiBold 0.16em uppercase slate-500)
 *     sub     "Blok başlangıç saati otomatik atanır."  (13px Regular fg-3 marginTop 6)
 *   SectionLabel "Süre"
 *   Duration grid: 3 cols, gap 8, padding '0 20px'
 *     Values: [15, 30, 45, 60, 90, 120]  label: "dakika"
 *     Each chip: paddingVertical 14, borderRadius 12, textAlign center
 *     Number: 20px Bold tabular-nums; Unit: 11px Regular marginTop 2 opacity 0.7 letterSpacing 0.06em
 *   SectionLabel "Sebep"
 *   Reason list (flex col gap 8, padding '0 20px'):
 *     { id: 'anlik',   title: 'Anlık müşteri', meta: 'Şu anda gelen müşteri için' }
 *     { id: 'mola',    title: 'Mola',          meta: 'Kahve / dinlenme arası'     }
 *     { id: 'kisisel', title: 'Kişisel',       meta: 'Telefon, evrak vs.'         }
 *     Row: padding 14, borderRadius 12, flex row gap 12
 *     Title: 15px SemiBold; Meta: 12px Regular opacity 0.6 marginTop 2
 *   SectionLabel "Önizleme"
 *   Preview BlokCard:
 *     bg slate-100 (stripe pattern), border 1px dashed slate-400, borderRadius 12, padding '16px 18px'
 *     12px Bold 0.18em uppercase fg-2: "{curReason.title.toUpperCase()} · {dur}DK"
 *   Button variant="primary" size="lg" full "Kapat"  (padding '24px 20px 0')
 *
 * Blocked / success state:
 *   flex col justifyContent center, gap 16, padding '20px 20px 32px'
 *   Check circle: width 56, height 56, borderRadius 999, bg slate-100, border slate-200
 *     SVG: path "M5 12.5L10 17.5L19 8" stroke ink-900 strokeWidth 2
 *   Title area (textAlign center):
 *     overline "Takvim Kapatıldı" 11px SemiBold 0.16em uppercase slate-500 marginBottom 8
 *     duration "{dur} dakika" 24px Bold letterSpacing -0.02em
 *     sub "{startTime} – {endTime} · {curReason.title}" 14px Regular fg-3 marginTop 6
 *   Block preview card (same stripe pattern):
 *     text "BLOKE · {curReason.title.toUpperCase()} · {dur}DK"
 *   Info text: 13px Regular fg-3 textAlign center lineHeight 1.5
 *   Button variant="secondary" size="lg" full "Yeni Blok Ekle"
 */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
const REASON_MAP: Record<'anlik' | 'mola' | 'kisisel', string> = {
  anlik: 'walkin',
  mola: 'break',
  kisisel: 'personal',
};

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function addMins(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/* Duration options — exact from BlokScreen source */
const DURATIONS = [15, 30, 45, 60, 90, 120] as const;

/* Reason options — exact from BlokScreen source */
const REASONS = [
  { id: 'anlik',   title: 'Anlık müşteri', meta: 'Şu anda gelen müşteri için' },
  { id: 'mola',    title: 'Mola',          meta: 'Kahve / dinlenme arası'     },
  { id: 'kisisel', title: 'Kişisel',       meta: 'Telefon, evrak vs.'         },
] as const;

/* ── OverlineHeader ─────────────────────────────────────────────────
 * Source: components.jsx OverlineHeader
 * padding: '8px 20px 16px'
 * eyebrow: 11px SemiBold 0.16em uppercase slate-500 lineHeight 1
 * title:   32px Bold -0.02em ink-900 marginTop 10 lineHeight 1.05
 * meta:    13px Regular fg-3 marginTop 8
 */
function OverlineHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string;
  title: string;
  meta?: string;
}) {
  return (
    <View style={styles.ohWrap}>
      <Text style={styles.ohEyebrow}>{eyebrow}</Text>
      <Text style={styles.ohTitle}>{title}</Text>
      {meta != null && <Text style={styles.ohMeta}>{meta}</Text>}
    </View>
  );
}

/* ── SectionLabel ───────────────────────────────────────────────────
 * Source: components.jsx SectionLabel
 * 11px SemiBold 0.16em uppercase slate-500, padding '0 20px', margin '24px 0 10px'
 */
function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

/* ── Card ─────────────────────────────────────────────────────────
 * Source: components.jsx Card
 * bg slate-0, border slate-200, borderRadius 12, boxShadow 0 1px 2px rgba(15,20,16,0.04)
 */
function Card({ children, padding = 16 }: { children: React.ReactNode; padding?: number }) {
  return <View style={[styles.card, { padding }]}>{children}</View>;
}

/* ── SCREEN ──────────────────────────────────────────────────────── */
export default function BlockScreen() {
  const [dur, setDur] = useState(30);
  const [reason, setReason] = useState<'anlik' | 'mola' | 'kisisel'>('mola');
  const [blocked, setBlocked] = useState(false);
  const [startTime] = useState<string>(nowTime); // captured when screen mounts
  const [staffId, setStaffId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('staff').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
        .then(({ data }) => { if (data) setStaffId((data as any).id); });
    });
  }, []);

  const curReason = REASONS.find(r => r.id === reason)!;
  const endTime = addMins(startTime, dur);

  /* ── Success / blocked state ────────────────────────────────── */
  if (blocked) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successWrap}>
          <View style={styles.successContent}>
            {/* Check circle: width 56, height 56, borderRadius 999, bg slate-100, border slate-200 */}
            <View style={styles.checkCircleWrap}>
              <View style={styles.checkCircle}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M5 12.5L10 17.5L19 8"
                    stroke={colors.ink[900]}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </View>

            {/* Title area */}
            <View style={styles.successTitleWrap}>
              {/* overline "Takvim Kapatıldı" 11px SemiBold 0.16em uppercase slate-500 marginBottom 8 */}
              <Text style={styles.successOverline}>Takvim Kapatıldı</Text>
              {/* duration: 24px Bold -0.02em */}
              <Text style={styles.successDur}>{dur} dakika</Text>
              {/* sub: 14px Regular fg-3 marginTop 6 */}
              <Text style={styles.successSub}>
                {startTime} – {endTime} · {curReason.title}
              </Text>
            </View>

            {/* Block preview card (stripe pattern) */}
            <View style={styles.previewCard}>
              <Text style={styles.previewText}>
                BLOKE · {curReason.title.toUpperCase()} · {dur}DK
              </Text>
            </View>

            {/* Info text: 13px Regular fg-3 textAlign center lineHeight 1.5 */}
            <Text style={styles.successInfo}>
              Müşteri randevu ekranında {startTime}–{endTime} arası kapalı görünecek.
            </Text>
          </View>

          {/* Button variant="secondary" size="lg" full "Yeni Blok Ekle" */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => { setBlocked(false); setDur(30); setReason('mola'); }}
          >
            <Text style={styles.secondaryBtnText}>Yeni Blok Ekle</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Form state ─────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* OverlineHeader eyebrow="Blok Ekle" title="Takvimi Kapat"
            meta="Şu andan itibaren seçtiğin süre boyunca takvim kapalı görünür." */}
        <OverlineHeader
          eyebrow="Blok Ekle"
          title="Takvimi Kapat"
          meta="Şu andan itibaren seçtiğin süre boyunca takvim kapalı görünür."
        />

        {/* Current time card */}
        <View style={styles.px20}>
          <Card padding={16}>
            {/* overline "Şu An · 10:42" */}
            <Text style={styles.currentTimeOverline}>Şu An · {startTime}</Text>
            {/* sub "Blok başlangıç saati otomatik atanır." */}
            <Text style={styles.currentTimeSub}>Blok başlangıç saati otomatik atanır.</Text>
          </Card>
        </View>

        {/* SectionLabel "Süre" */}
        <SectionLabel>Süre</SectionLabel>

        {/* Duration grid: 3 cols, gap 8, padding '0 20px'
            Values: 15, 30, 45, 60, 90, 120 — label: "dakika" */}
        <View style={styles.durGrid}>
          {DURATIONS.map(m => {
            const sel = dur === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => setDur(m)}
                activeOpacity={0.8}
                style={[styles.durChip, sel ? styles.durChipActive : styles.durChipInactive]}
              >
                {/* Number: 20px Bold tabular-nums */}
                <Text style={[styles.durNum, sel && styles.durNumActive]}>{m}</Text>
                {/* Unit: 11px Regular marginTop 2 opacity 0.7 letterSpacing 0.06em "dakika" */}
                <Text style={[styles.durUnit, sel && styles.durUnitActive]}>dakika</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* SectionLabel "Sebep" */}
        <SectionLabel>Sebep</SectionLabel>

        {/* Reason list: flex col gap 8, padding '0 20px'
            Each row: padding 14, borderRadius 12, flex row gap 12
            Title 15px SemiBold; Meta 12px Regular opacity 0.6 marginTop 2 */}
        <View style={styles.reasonList}>
          {REASONS.map(r => {
            const sel = reason === r.id;
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => setReason(r.id)}
                activeOpacity={0.8}
                style={[styles.reasonRow, sel ? styles.reasonRowActive : styles.reasonRowInactive]}
              >
                <View style={styles.reasonIconPlaceholder}>
                  {/* Icon placeholder — lucide icon name: anlik→user-check, mola→coffee, kisisel→user */}
                  <Text style={[styles.reasonIconDot, sel && styles.reasonIconDotActive]}>•</Text>
                </View>
                <View style={styles.reasonRight}>
                  <Text style={[styles.reasonTitle, sel && styles.reasonTitleActive]}>
                    {r.title}
                  </Text>
                  <Text style={[styles.reasonMeta, sel && styles.reasonMetaActive]}>
                    {r.meta}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* SectionLabel "Önizleme" */}
        <SectionLabel>Önizleme</SectionLabel>

        {/* Preview BlokCard:
            bg slate-100, 1px dashed slate-400, borderRadius 12, padding '16px 18px'
            12px Bold 0.18em uppercase fg-2: "{curReason.title.toUpperCase()} · {dur}DK" */}
        <View style={styles.px20}>
          <View style={styles.previewCard}>
            <Text style={styles.previewText}>
              {curReason.title.toUpperCase()} · {dur}DK
            </Text>
          </View>
        </View>

        {/* Button variant="primary" size="lg" full "Kapat" */}
        <View style={styles.btnWrap}>
          <TouchableOpacity style={styles.primaryBtn} disabled={saving} onPress={async () => {
            if (!staffId) {
              Alert.alert('Hata', 'Hesap bilgileri yüklenemedi. Lütfen tekrar deneyin.');
              return;
            }

            setSaving(true);
            try {
              const { error } = await supabase.functions.invoke('create-manual-block', {
                body: { staff_id: staffId, duration_min: dur, reason: REASON_MAP[reason] },
              });
              if (error) {
                Alert.alert('Hata', `Blok eklenemedi: ${error.message}`);
                return;
              }
              setBlocked(true);
            } finally {
              setSaving(false);
            }
          }}>
            <Text style={styles.primaryBtnText}>{saving ? 'Kaydediliyor...' : 'Kapat'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  /* OverlineHeader: padding '8px 20px 16px' */
  ohWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  ohEyebrow: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 11 * 0.16,
    textTransform: 'uppercase',
    color: colors.slate[500],
    lineHeight: 11,
  },
  ohTitle: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 32,
    letterSpacing: 32 * -0.02,
    color: colors.ink[900],
    marginTop: 10,
    lineHeight: 33.6,
  },
  ohMeta: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    color: colors.slate[500],
    marginTop: 8,
  },

  /* SectionLabel: 11px SemiBold 0.16em uppercase slate-500, paddingHorizontal 20, margin '24px 0 10px' */
  sectionLabel: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 11 * 0.16,
    textTransform: 'uppercase',
    color: colors.slate[500],
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 10,
  },

  /* Card: bg slate-0, border slate-200, borderRadius 12, shadow 0 1px 2px */
  card: {
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 12,
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  px20: { paddingHorizontal: 20 },

  /* Current time card content */
  currentTimeOverline: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 11 * 0.16,
    textTransform: 'uppercase',
    color: colors.slate[500],
  },
  currentTimeSub: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    color: colors.slate[500],
    marginTop: 6,
  },

  /* Duration grid: paddingHorizontal 20, flex row wrap, gap 8 — 3 cols */
  durGrid: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  /* Each chip is ~1/3 row width accounting for 2 gaps of 8px in 3-col layout */
  durChip: {
    width: '30.5%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  durChipActive: {
    backgroundColor: colors.ink[900],
    borderColor: colors.ink[900],
  },
  durChipInactive: {
    backgroundColor: colors.slate[0],
    borderColor: colors.slate[200],
  },
  /* Number: 20px Bold tabular-nums */
  durNum: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 20,
    color: colors.ink[900],
  },
  durNumActive: { color: '#ffffff' },
  /* Unit: 11px Regular marginTop 2 opacity 0.7 letterSpacing 0.06em */
  durUnit: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 11,
    marginTop: 2,
    opacity: 0.7,
    letterSpacing: 11 * 0.06,
    color: colors.ink[900],
  },
  durUnitActive: { color: '#ffffff' },

  /* Reason list: paddingHorizontal 20, gap 8 */
  reasonList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  /* Reason row: padding 14, borderRadius 12, flex row, gap 12, border 1px */
  reasonRow: {
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  reasonRowActive: {
    backgroundColor: colors.ink[900],
    borderColor: colors.ink[900],
  },
  reasonRowInactive: {
    backgroundColor: colors.slate[0],
    borderColor: colors.slate[200],
  },
  /* Icon placeholder 22×22 */
  reasonIconPlaceholder: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.85,
  },
  reasonIconDot: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 18,
    color: colors.ink[900],
  },
  reasonIconDotActive: { color: '#ffffff' },
  reasonRight: { flex: 1 },
  /* Title: 15px SemiBold */
  reasonTitle: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 15,
    color: colors.ink[900],
  },
  reasonTitleActive: { color: '#ffffff' },
  /* Meta: 12px Regular opacity 0.6 marginTop 2 */
  reasonMeta: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 12,
    color: colors.slate[500],
    marginTop: 2,
    opacity: 0.6,
  },
  reasonMetaActive: { color: 'rgba(255,255,255,0.6)', opacity: 1 },

  /* Preview BlokCard: bg slate-100, 1px dashed slate-400, borderRadius 12, padding '16px 18px' */
  previewCard: {
    backgroundColor: colors.slate[100],
    borderWidth: 1,
    borderColor: colors.slate[400],
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  /* Preview text: 12px Bold 0.18em uppercase fg-2 */
  previewText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 12,
    letterSpacing: 12 * 0.18,
    textTransform: 'uppercase',
    color: colors.slate[700],
  },

  /* Primary CTA button: variant="primary" size="lg": bg ink-900, height 52, borderRadius 12 */
  btnWrap: { paddingHorizontal: 20, paddingTop: 24 },
  primaryBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.ink[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 15,
    color: '#ffffff',
    letterSpacing: 15 * -0.005,
  },

  /* ── Success state ────────────────────────────────────────────── */
  /* Outer container: flex 1, padding '20px 20px 32px', justifyContent 'space-between' */
  successWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  /* Content area: flex 1, justifyContent center, gap 16 */
  successContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  /* Check circle wrapper: alignItems center, marginBottom 8 */
  checkCircleWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  /* Check circle: width 56, height 56, borderRadius 999, bg slate-100, border slate-200 */
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: colors.slate[100],
    borderWidth: 1,
    borderColor: colors.slate[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Title area: alignItems center */
  successTitleWrap: { alignItems: 'center' },
  /* "Takvim Kapatıldı" overline: 11px SemiBold 0.16em uppercase slate-500 marginBottom 8 */
  successOverline: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 11 * 0.16,
    textTransform: 'uppercase',
    color: colors.slate[500],
    marginBottom: 8,
  },
  /* "{dur} dakika": 24px Bold -0.02em ink-900 */
  successDur: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 24,
    letterSpacing: 24 * -0.02,
    color: colors.ink[900],
  },
  /* sub: 14px Regular fg-3 marginTop 6 */
  successSub: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
    color: colors.slate[500],
    marginTop: 6,
  },
  /* Info text: 13px Regular fg-3 textAlign center lineHeight 1.5 */
  successInfo: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    color: colors.slate[500],
    textAlign: 'center',
    lineHeight: 19.5,
  },
  /* Secondary button: variant="secondary" size="lg": transparent bg, border ink-900, height 52 */
  secondaryBtn: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[900],
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 15,
    color: colors.ink[900],
    letterSpacing: 15 * -0.005,
  },
});
