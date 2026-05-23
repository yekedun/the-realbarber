/**
 * M4 · Ajanda Ekranı (Owner)
 * Source: screens.jsx — AjandaScreen() + screen-20-ajanda-v2.html — AjandaDrag()
 *
 * OverlineHeader: eyebrow="Berber · Dükkan Paneli" title="Ajanda"
 * DayPicker: selected index 2 (today = 7 Mayıs 2026, Çarşamba)
 *
 * Two-column layout — flex:1 overflow:auto display:flex gap:12
 * padding:'20px 16px 90px' minWidth:0
 *
 * Column structure (source: flex:'0 0 230px'):
 *   Col header:
 *     name  — 15px bold
 *     meta  — 11px semiBold 0.12em uppercase slate-500 marginTop:4
 *             "{count} randevu[ · {blok} blok]"
 *   Items — gap:10
 *
 * Mehmet: count=5, blok=1
 *   09:00 / 30dk  Can Demir    / Saç kesim · 30dk          (done)
 *   10:30 / 45dk  Ahmet Yılmaz / Saç + Sakal · 45 dk       (upcoming)
 *   13:00 / 45dk  BLOKE · Mola                              (block)
 *   14:30 / 30dk  Kerem Arslan / Saç kesim · 30 dk         (active)
 *   16:00 / 60dk  Ozan Y.      / Saç + Sakal + Boya · 60 dk (upcoming)
 *
 * Can: count=3, blok=0
 *   11:15 / 30dk  Mehmet Kaya / Saç kesim · 30 dk   (upcoming)
 *   15:00 / 45dk  Burak Ş.    / Saç + Sakal · 45 dk (upcoming)
 *
 * Empty drop zone (per AjandaDrag source):
 *   border:'2px dashed var(--brand-600)' borderRadius:10 padding:'20px 10px'
 *   textAlign:'center' fontSize:11 fontWeight:600 color:brand-600
 *   background:'rgba(30,58,138,0.03)' text="Bırak"
 *
 * FAB — position:absolute bottom:90 right:12 (AjandaDrag uses right:12, AjandaScreen uses right:20)
 *   Button variant="accent" size="md" text="Randevu Ekle"
 *   shadow: boxShadow:'0 8px 20px -6px rgba(30,58,138,0.5)'
 *   (screens.jsx uses size="lg" right:20 shadow:'0 12px 24px -10px rgba(30,58,138,0.4)')
 *   → use size="lg" right:20 per screens.jsx (the primary reference)
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors } from '../../lib/theme';
import { OverlineHeader } from '../../components/ds/OverlineHeader';
import { DayPicker } from '../../components/ds/DayPicker';
import { AppointmentCard } from '../../components/ds/AppointmentCard';
import { BlokCard } from '../../components/ds/BlokCard';
import { Button } from '../../components/ds/Button';

// TODO: connect Supabase — fetch appointments + blocks for selectedDate

type AppState = 'done' | 'active' | 'upcoming';

interface AppItem {
  type: 'appt';
  id: string;
  time: string;
  dur: number;
  name: string;
  svc: string;
  state: AppState;
}
interface BlokItem {
  type: 'blok';
  id: string;
  time: string;
  dur: number;
  label: string;
}
type ColItem = AppItem | BlokItem;

interface StaffCol {
  id: string;
  name: string;
  count: number;
  blok: number;
  items: ColItem[];
}

const INIT_COLS: StaffCol[] = [
  {
    id: 'mehmet', name: 'Mehmet', count: 5, blok: 1,
    items: [
      { type: 'appt', id: 'a1', time: '09:00', dur: 30, name: 'Can Demir',    svc: 'Saç kesim · 30dk',           state: 'done'     },
      { type: 'appt', id: 'a2', time: '10:30', dur: 45, name: 'Ahmet Yılmaz', svc: 'Saç + Sakal · 45 dk',        state: 'upcoming' },
      { type: 'blok', id: 'a3', time: '13:00', dur: 45, label: 'BLOKE · Mola'                                                      },
      { type: 'appt', id: 'a4', time: '14:30', dur: 30, name: 'Kerem Arslan', svc: 'Saç kesim · 30 dk',          state: 'active'   },
      { type: 'appt', id: 'a5', time: '16:00', dur: 60, name: 'Ozan Y.',      svc: 'Saç + Sakal + Boya · 60 dk', state: 'upcoming' },
    ],
  },
  {
    id: 'can', name: 'Can', count: 3, blok: 0,
    items: [
      { type: 'appt', id: 'b1', time: '11:15', dur: 30, name: 'Mehmet Kaya', svc: 'Saç kesim · 30 dk',  state: 'upcoming' },
      { type: 'appt', id: 'b2', time: '15:00', dur: 45, name: 'Burak Ş.',    svc: 'Saç + Sakal · 45 dk', state: 'upcoming' },
    ],
  },
];

/* ── Empty drop zone ─────────────────────────────────────────── */
function EmptyDropZone() {
  return (
    <View style={styles.dropZone}>
      <Text style={styles.dropZoneText}>Bırak</Text>
    </View>
  );
}

/* ── Main Screen ─────────────────────────────────────────────── */
function getToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function AgendaScreen() {
  const [selectedDate, setSelectedDate] = useState<Date>(getToday);

  function handleAddAppointment() {
    // TODO: connect Supabase — open AddAppointmentSheet with selectedDate pre-filled
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <OverlineHeader eyebrow="Berber · Dükkan Paneli" title="Ajanda" />

      {/* DayPicker — gap:6, padding:'0 16px' */}
      <DayPicker
        selected={selectedDate}
        onSelect={d => {
          setSelectedDate(d);
          // TODO: connect Supabase — refetch appointments + blocks for new date
        }}
      />

      {/* Two-column horizontal scroll — flex:1, gap:12, padding:'20px 16px 90px' */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.colScroll}
        contentContainerStyle={styles.colContent}
      >
        {INIT_COLS.map(col => (
          <View key={col.id} style={styles.col}>
            {/* Column header — padding:'0 4px 4px' */}
            <View style={styles.colHeader}>
              <Text style={styles.colName}>{col.name}</Text>
              <Text style={styles.colMeta}>
                {col.count} randevu{col.blok > 0 ? ` · ${col.blok} blok` : ''}
              </Text>
            </View>

            {/* Items — gap:10 */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.itemContent}
            >
              {col.items.length === 0 ? (
                <EmptyDropZone />
              ) : (
                col.items.map(item =>
                  item.type === 'blok' ? (
                    <BlokCard
                      key={item.id}
                      time={item.time}
                      duration={item.dur}
                      label={item.label}
                    />
                  ) : (
                    <AppointmentCard
                      key={item.id}
                      time={item.time}
                      duration={item.dur}
                      name={item.name}
                      service={item.svc}
                      state={item.state}
                      onPress={() => {
                        // TODO: connect Supabase — open AppointmentDetailSheet
                      }}
                    />
                  )
                )
              )}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* FAB — position:absolute bottom:90 right:20
          variant="accent" size="lg" "+ Randevu Ekle"
          shadow: 0 12px 24px -10px rgba(30,58,138,0.4) */}
      <View style={styles.fab}>
        <Button
          variant="accent"
          size="lg"
          onPress={handleAddAppointment}
        >
          + Randevu Ekle
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },

  /* Horizontal column scroll — flex:1, gap:12, padding:'20px 16px 90px' */
  colScroll: { flex: 1 },
  colContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 90,
  },

  /* Each column — flex:'0 0 230px' */
  col: {
    width: 230,
    flexDirection: 'column',
  },

  /* Column header — padding:'0 4px 4px' */
  colHeader: {
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  colName: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: colors.ink[900],
  },
  colMeta: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    letterSpacing: 1.32,           // 0.12em × 11
    textTransform: 'uppercase',
    color: colors.slate[500],
    marginTop: 4,
  },

  /* Item list — gap:10 */
  itemContent: { gap: 10 },

  /* Empty drop zone (AjandaDrag source):
     border:'2px dashed brand-600' borderRadius:10 padding:'20px 10px'
     text center 11px semiBold brand-600, bg rgba(30,58,138,0.03) */
  dropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.brand[600],
    borderRadius: 10,
    paddingVertical: 20,
    paddingHorizontal: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(30,58,138,0.03)',
  },
  dropZoneText: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.brand[600],
  },

  /* FAB — position:absolute bottom:90 right:20
     shadowColor = brand-600 (~rgba(30,58,138,...))
     shadowOffset y:12, opacity:0.4, radius:14 (≈ 24-10 = spread subtraction) */
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    zIndex: 10,
    shadowColor: colors.brand[600],
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
});
