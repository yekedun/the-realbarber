/**
 * M9 — Staff: Randevular screen
 * Source: screens.jsx → RandevularScreen
 *
 * Layout (exact from source):
 *   height: '100%', display: 'flex', flexDirection: 'column'
 *   OverlineHeader eyebrow="Berber · Dükkan Paneli" title="Randevular" meta="7 Mayıs 2026, Çar"
 *   DayPicker selected={day} onSelect={setDay}
 *   ScrollView: padding '20px 20px 100px', gap 8, flexCol
 *     SectionLabel "Tamamlandı"  (padding: 0, margin: '0 0 4px')
 *     AppointmentCard 09:00 30min Can Demir   "Saç kesim · 30dk"    state=done
 *     AppointmentCard 09:30 20min Burak Ş.    "Sakal · 20dk"        state=done
 *     SectionLabel "Şu Anda"    (margin: '12px 0 4px')
 *     AppointmentCard 10:30 45min Ahmet Yılmaz "Saç + Sakal · 45 dk" state=active → opens detail sheet
 *     SectionLabel "Gelecek"    (margin: '12px 0 4px')
 *     AppointmentCard 11:15 30min Mehmet Kaya  "Saç kesim · 30 dk"
 *     BlokCard        13:00 45min "BLOKE · Mola"
 *     AppointmentCard 14:30 30min Kerem Arslan "Saç kesim · 30 dk"
 *     AppointmentCard 16:00 60min Ozan Y.      "Saç + Sakal + Boya · 60 dk"
 *   FAB: position absolute, bottom 90, right 20, z-index 10
 *     Button variant="accent" size="lg" "+ Yeni Randevu"
 *     boxShadow: '0 12px 24px -10px rgba(30,58,138,0.4)'
 *
 * Empty state (screen-27 EmptyRandevular):
 *   icon CalendarEmpty (brand-600), title "Bugün randevu yok"
 *   body "20 Mayıs için randevu bulunmuyor. Yeni randevu ekleyebilirsiniz."
 *   cta "Yeni Randevu" ctaVariant="accent"
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { colors } from '../../lib/theme';
import { AppointmentDetailSheet } from '../../components/AppointmentDetailSheet';
import { AddAppointmentModal, ServiceOption } from '../../components/AddAppointmentModal';

// TODO: connect Supabase — fetch appointments for authenticated staff by selected date
// supabase.from('appointments').select('*').eq('staff_id', staffId).eq('date', selectedDate)
// Subscribe to realtime changes on 'appointments' table

/* ── TR day labels ──────────────────────────────────────────────── */
const TR_DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

/* ── DayPicker ──────────────────────────────────────────────────────
 * Source: components.jsx DayPicker
 * today = new Date(2026, 4, 7) — 7 Mayıs 2026 (Çarşamba)
 * 7 days, starting 2 before today (index 2 = today)
 * Selected cell: bg ink-900, border ink-900, color #fff
 * Each cell: flex 0 0 56px, height 64, borderRadius 12, gap 2
 * Day label: 10px SemiBold letterSpacing 0.12em uppercase opacity 0.7
 * Date number: 18px Bold tabular-nums
 */
function DayPicker({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (i: number) => void;
}) {
  const today = new Date(2026, 4, 7); // 7 Mayıs 2026
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 2 + i);
    return d;
  });
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.dayPickerContent}
    >
      {days.map((d, i) => {
        const isSel = selected === i;
        const dowIdx = (d.getDay() + 6) % 7;
        return (
          <TouchableOpacity
            key={i}
            onPress={() => onSelect(i)}
            activeOpacity={0.8}
            style={[styles.dayCell, isSel ? styles.dayCellActive : styles.dayCellInactive]}
          >
            <Text style={[styles.dayDow, isSel && styles.dayDowActive]}>
              {TR_DAYS_SHORT[dowIdx]}
            </Text>
            <Text style={[styles.dayNum, isSel && styles.dayNumActive]}>
              {d.getDate()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/* ── SectionLabel ───────────────────────────────────────────────────
 * Source: components.jsx SectionLabel
 * fontSize 11, fontWeight 600, letterSpacing 0.16em, uppercase, color slate-500
 * padding: '0 20px', margin: '24px 0 10px'
 * Accepts topMargin override for the "Şu Anda" / "Gelecek" labels (12px)
 */
function SectionLabel({
  children,
  topMargin = 0,
}: {
  children: string;
  topMargin?: number;
}) {
  return (
    <Text style={[styles.sectionLabel, { marginTop: topMargin }]}>{children}</Text>
  );
}

/* ── AppointmentCard ────────────────────────────────────────────────
 * Source: components.jsx AppointmentCard
 * variants: upcoming (slate-0/slate-200/ink-900), active (brand-600/brand-700/#fff), done (slate-0, opacity 0.55, strikethrough)
 * Layout: borderRadius 12, padding 14, flex row, gap 14
 * Left col (minWidth 56): time 14px Bold, dur 10px SemiBold letterSpacing 0.14em uppercase " DK"
 * Right col (flex 1): name 15px SemiBold, service 12px Regular
 */
type ApptState = 'upcoming' | 'active' | 'done';

interface ApptCardProps {
  time: string;
  duration: number;
  name: string;
  service: string;
  state?: ApptState;
  onPress?: () => void;
}

function AppointmentCard({ time, duration, name, service, state = 'upcoming', onPress }: ApptCardProps) {
  const v = {
    upcoming: {
      bg: colors.slate[0],
      border: colors.slate[200],
      text: colors.ink[900],
      sub: colors.slate[500],
      dur: colors.slate[500],
      opacity: 1 as number,
      strike: false,
    },
    active: {
      bg: colors.brand[600],
      border: colors.brand[700],
      text: '#ffffff' as string,
      sub: 'rgba(255,255,255,0.6)' as string,
      dur: 'rgba(255,255,255,0.6)' as string,
      opacity: 1 as number,
      strike: false,
    },
    done: {
      bg: colors.slate[0],
      border: colors.slate[200],
      text: colors.ink[900],
      sub: colors.slate[500],
      dur: colors.slate[500],
      opacity: 0.55 as number,
      strike: true,
    },
  }[state];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      style={[
        styles.apptCard,
        { backgroundColor: v.bg, borderColor: v.border, opacity: v.opacity },
      ]}
    >
      {/* Left col */}
      <View style={styles.apptLeft}>
        <Text style={[styles.apptTime, { color: v.text }]}>{time}</Text>
        <Text style={[styles.apptDur, { color: v.dur }]}>{duration} DK</Text>
      </View>
      {/* Right col */}
      <View style={styles.apptRight}>
        <Text
          style={[
            styles.apptName,
            { color: v.text, textDecorationLine: v.strike ? 'line-through' : 'none' },
          ]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text style={[styles.apptService, { color: v.sub }]} numberOfLines={1}>
          {service}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/* ── BlokCard ───────────────────────────────────────────────────────
 * Source: components.jsx BlokCard
 * background: repeating-linear-gradient(45deg, slate-100 0 6px, slate-200 6px 12px) → slate-100 in RN
 * border: 1px dashed slate-400, borderRadius 12, padding 14, flex row, gap 14
 * Left: time 14px Bold slate-700, dur 10px SemiBold 0.14em uppercase slate-500
 * Right: label 11px Bold 0.18em uppercase fg-2 (slate-700)
 */
function BlokCard({ time, duration, label }: { time: string; duration: number; label: string }) {
  return (
    <View style={styles.blokCard}>
      <View style={styles.apptLeft}>
        <Text style={styles.blokTime}>{time}</Text>
        <Text style={styles.blokDur}>{duration} DK</Text>
      </View>
      <View style={styles.blokRight}>
        <Text style={styles.blokLabel}>{label}</Text>
      </View>
    </View>
  );
}

/* ── CalendarEmpty SVG ──────────────────────────────────────────────
 * Source: screen-27-empty-states.html CalendarEmpty (color = brand-600)
 */
function CalendarEmptyIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
      <Rect x="3" y="6" width="26" height="22" rx="4" stroke={colors.brand[600]} strokeWidth="1.8" />
      <Path d="M3 13h26" stroke={colors.brand[600]} strokeWidth="1.6" />
      <Path d="M11 4v4M21 4v4" stroke={colors.brand[600]} strokeWidth="1.8" strokeLinecap="round" />
      <Circle cx="11" cy="20" r="1.5" fill={colors.brand[600]} opacity={0.4} />
      <Circle cx="16" cy="20" r="1.5" fill={colors.brand[600]} opacity={0.4} />
      <Circle cx="21" cy="20" r="1.5" fill={colors.brand[600]} opacity={0.4} />
    </Svg>
  );
}

/* ── EmptyState ─────────────────────────────────────────────────────
 * Source: screen-27-empty-states.html EmptyRandevular → EmptyState
 * icon container: width 72, height 72, borderRadius 20, bg brand-100, border brand-100
 * title (17px Bold fg-1): "Bugün randevu yok"
 * body (13px Regular fg-3 lineHeight 1.55): "20 Mayıs için randevu bulunmuyor. Yeni randevu ekleyebilirsiniz."
 * cta: Button variant=accent size=md "Yeni Randevu"
 */
function EmptyState({ onCta }: { onCta?: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconBox}>
        <CalendarEmptyIcon />
      </View>
      <Text style={styles.emptyTitle}>Bugün randevu yok</Text>
      <Text style={styles.emptyBody}>
        {'20 Mayıs için randevu bulunmuyor. Yeni randevu ekleyebilirsiniz.'}
      </Text>
      {onCta && (
        <TouchableOpacity style={styles.emptyCtaBtn} onPress={onCta}>
          <Text style={styles.emptyCtaText}>Yeni Randevu</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ── Mock data — exact from screens.jsx RandevularScreen ────────────
 *   09:00 30 Can Demir   "Saç kesim · 30dk"       done
 *   09:30 20 Burak Ş.    "Sakal · 20dk"            done
 *   10:30 45 Ahmet Yılmaz "Saç + Sakal · 45 dk"   active  (opens detail sheet)
 *   11:15 30 Mehmet Kaya  "Saç kesim · 30 dk"
 *   [BLOK] 13:00 45 "BLOKE · Mola"
 *   14:30 30 Kerem Arslan "Saç kesim · 30 dk"
 *   16:00 60 Ozan Y.      "Saç + Sakal + Boya · 60 dk"
 */
type ListItem =
  | { kind: 'section'; label: string; topMargin?: number }
  | { kind: 'appt'; time: string; duration: number; name: string; service: string; state?: ApptState; isDetail?: boolean }
  | { kind: 'blok'; time: string; duration: number; label: string };

const LIST_ITEMS: ListItem[] = [
  { kind: 'section', label: 'Tamamlandı', topMargin: 0 },
  { kind: 'appt', time: '09:00', duration: 30, name: 'Can Demir', service: 'Saç kesim · 30dk', state: 'done' },
  { kind: 'appt', time: '09:30', duration: 20, name: 'Burak Ş.', service: 'Sakal · 20dk', state: 'done' },
  { kind: 'section', label: 'Şu Anda', topMargin: 12 },
  { kind: 'appt', time: '10:30', duration: 45, name: 'Ahmet Yılmaz', service: 'Saç + Sakal · 45 dk', state: 'active', isDetail: true },
  { kind: 'section', label: 'Gelecek', topMargin: 12 },
  { kind: 'appt', time: '11:15', duration: 30, name: 'Mehmet Kaya', service: 'Saç kesim · 30 dk' },
  { kind: 'blok', time: '13:00', duration: 45, label: 'BLOKE · Mola' },
  { kind: 'appt', time: '14:30', duration: 30, name: 'Kerem Arslan', service: 'Saç kesim · 30 dk' },
  { kind: 'appt', time: '16:00', duration: 60, name: 'Ozan Y.', service: 'Saç + Sakal + Boya · 60 dk' },
];

/* ── Mock services for AddAppointmentModal ──────────────────────── */
// TODO: connect Supabase — fetch services from shop_services table
const MOCK_SERVICES: ServiceOption[] = [
  { id: 'sac',       label: 'Saç kesim',    dur: 30, price: '200₺' },
  { id: 'sakal',     label: 'Sakal tıraşı', dur: 20, price: '120₺' },
  { id: 'sac-sakal', label: 'Saç + Sakal',  dur: 45, price: '280₺' },
];

/* ── Mock appointment for detail sheet ─────────────────────────── */
const MOCK_DETAIL_APPT = {
  id: 'appt-1',
  time: '10:30',
  duration: 45,
  customerName: 'Ahmet Yılmaz',
  customerPhone: null as string | null,
  serviceName: 'Saç + Sakal · 45 dk · 280₺',
};

/* ── SCREEN ──────────────────────────────────────────────────────── */
export default function RandevularScreen() {
  const [day, setDay] = useState(2); // index 2 = today (Çar 7 Mayıs)
  const [showDetail, setShowDetail] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // TODO: connect Supabase — when day changes, re-fetch appointments for that date
  // isEmpty = true when no appointments exist for the selected day
  const isEmpty = false;

  return (
    <SafeAreaView style={styles.safe}>
      {/* OverlineHeader — exact from screens.jsx RandevularScreen
          eyebrow "Berber · Dükkan Paneli", title "Randevular", meta "7 Mayıs 2026, Çar" */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Berber · Dükkan Paneli</Text>
        <Text style={styles.title}>Randevular</Text>
        <Text style={styles.meta}>7 Mayıs 2026, Çar</Text>
      </View>

      {/* DayPicker */}
      <DayPicker selected={day} onSelect={setDay} />

      {isEmpty ? (
        /* Empty state — screen-27 EmptyRandevular */
        <EmptyState onCta={() => setShowAdd(true)} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {LIST_ITEMS.map((item, idx) => {
            if (item.kind === 'section') {
              return (
                <SectionLabel key={idx} topMargin={item.topMargin ?? 0}>
                  {item.label}
                </SectionLabel>
              );
            }
            if (item.kind === 'blok') {
              return (
                <BlokCard
                  key={idx}
                  time={item.time}
                  duration={item.duration}
                  label={item.label}
                />
              );
            }
            return (
              <AppointmentCard
                key={idx}
                time={item.time}
                duration={item.duration}
                name={item.name}
                service={item.service}
                state={item.state}
                onPress={item.isDetail ? () => setShowDetail(true) : undefined}
              />
            );
          })}
        </ScrollView>
      )}

      {/* FAB — position absolute, bottom 90, right 20, z-index 10
          Button variant="accent" size="lg", boxShadow 0 12px 24px -10px rgba(30,58,138,0.4) */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)}>
        <Text style={styles.fabText}>+ Yeni Randevu</Text>
      </TouchableOpacity>

      {/* Appointment detail sheet */}
      <AppointmentDetailSheet
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        appointment={MOCK_DETAIL_APPT}
        onEdit={() => { /* TODO: connect Supabase — navigate to edit */ }}
        onCancel={() => { /* TODO: connect Supabase — cancel appointment */ }}
        onComplete={() => { /* TODO: connect Supabase — mark appointment completed */ }}
      />

      {/* Add appointment modal */}
      <AddAppointmentModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={() => {
          // TODO: connect Supabase — insert new appointment
          setShowAdd(false);
        }}
        services={MOCK_SERVICES}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    // background: 'var(--slate-50)' from index.html ios-content
    backgroundColor: colors.slate[50],
    position: 'relative',
  },

  /* OverlineHeader (components.jsx):
     padding: '8px 20px 16px'
     eyebrow: 11px SemiBold letterSpacing 0.16em uppercase slate-500 lineHeight 1
     title:   32px Bold letterSpacing -0.02em ink-900 marginTop 10 lineHeight 1.05
     meta:    13px Regular fg-3 (slate-500) marginTop 8 */
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  eyebrow: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 11 * 0.16,   // 0.16em
    textTransform: 'uppercase',
    color: colors.slate[500],
    lineHeight: 11,
  },
  title: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 32,
    letterSpacing: 32 * -0.02,  // -0.02em
    color: colors.ink[900],
    marginTop: 10,
    lineHeight: 33.6,           // 1.05
  },
  meta: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    color: colors.slate[500],
    marginTop: 8,
  },

  /* DayPicker: gap 6, paddingHorizontal 16 */
  dayPickerContent: {
    gap: 6,
    paddingHorizontal: 16,
  },

  /* Day cell: width 56, height 64, borderRadius 12, gap 2 */
  dayCell: {
    width: 56,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
  },
  dayCellActive: {
    backgroundColor: colors.ink[900],
    borderColor: colors.ink[900],
  },
  dayCellInactive: {
    backgroundColor: colors.slate[0],
    borderColor: colors.slate[200],
  },
  dayDow: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
    letterSpacing: 10 * 0.12,   // 0.12em
    textTransform: 'uppercase',
    color: colors.ink[900],
    opacity: 0.7,
  },
  dayDowActive: { color: '#ffffff', opacity: 0.7 },
  dayNum: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 18,
    color: colors.ink[900],
  },
  dayNumActive: { color: '#ffffff' },

  /* SectionLabel: 11px SemiBold 0.16em uppercase slate-500, marginBottom 4 */
  sectionLabel: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 11 * 0.16,
    textTransform: 'uppercase',
    color: colors.slate[500],
    marginBottom: 4,
  },

  scroll: { flex: 1 },
  /* ScrollView content: padding '20px 20px 100px', gap 8 */
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
    gap: 8,
  },

  /* AppointmentCard: borderRadius 12, padding 14, flex row, gap 14, border 1px
     boxShadow: '0 1px 2px rgba(15,20,16,0.04)' */
  apptCard: {
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  apptLeft: { minWidth: 56 },
  apptTime: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
    lineHeight: 14,
  },
  apptDur: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
    letterSpacing: 10 * 0.14,   // 0.14em
    textTransform: 'uppercase',
    marginTop: 5,
  },
  apptRight: { flex: 1, minWidth: 0 },
  apptName: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 15,
    lineHeight: 18,
  },
  apptService: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 12,
    marginTop: 2,
  },

  /* BlokCard: bg slate-100 (stripe pattern simulated), 1px dashed slate-400,
     borderRadius 12, padding 14, flex row, gap 14 */
  blokCard: {
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    backgroundColor: colors.slate[100],
    borderWidth: 1,
    borderColor: colors.slate[400],
    borderStyle: 'dashed',
  },
  blokRight: { flex: 1, alignSelf: 'center' },
  blokTime: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
    color: colors.slate[700],
  },
  blokDur: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
    letterSpacing: 10 * 0.14,
    textTransform: 'uppercase',
    color: colors.slate[500],
    marginTop: 5,
  },
  blokLabel: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 11,
    letterSpacing: 11 * 0.18,   // 0.18em
    textTransform: 'uppercase',
    color: colors.slate[700],
  },

  /* EmptyState (screen-27 EmptyRandevular):
     flex 1, alignItems center, justifyContent center, paddingHorizontal 28 */
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  /* icon container: width 72, height 72, borderRadius 20, bg brand-100, border brand-100 */
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.brand[100],
    borderWidth: 1,
    borderColor: colors.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  /* title: 17px Bold letterSpacing -0.01em color fg-1, lineHeight 1.2, marginBottom 8 */
  emptyTitle: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 17,
    letterSpacing: 17 * -0.01,
    color: colors.ink[900],
    lineHeight: 20.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  /* body: 13px Regular color fg-3 lineHeight 1.55, marginBottom 24 */
  emptyBody: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    color: colors.slate[500],
    lineHeight: 20.15,
    textAlign: 'center',
    marginBottom: 24,
  },
  /* CTA: Button variant=accent size=md → bg brand-600, border brand-700, height 44, borderRadius 12 */
  emptyCtaBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: colors.brand[600],
    borderWidth: 1,
    borderColor: colors.brand[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 14,
    color: '#ffffff',
    letterSpacing: 14 * -0.005,
  },

  /* FAB: position absolute, bottom 90, right 20, z-index 10
     Button variant=accent size=lg → height 52, paddingHorizontal 20, borderRadius 12, bg brand-600
     boxShadow: '0 12px 24px -10px rgba(30,58,138,0.4)' */
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    zIndex: 10,
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.brand[600],
    borderWidth: 1,
    borderColor: colors.brand[700],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand[600],
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  fabText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 15,
    color: '#ffffff',
    letterSpacing: 15 * -0.005,
  },
});
