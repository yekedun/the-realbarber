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
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { colors } from '../../lib/theme';
import { OverlineHeader } from '../../components/ds/OverlineHeader';
import { DayPicker } from '../../components/ds/DayPicker';
import { AppointmentCard } from '../../components/ds/AppointmentCard';
import { BlokCard } from '../../components/ds/BlokCard';
import { Button } from '../../components/ds/Button';
import { supabase } from '../../lib/supabase';
import { formatTime, translateReason, AppointmentState as AppState } from '../../lib/utils';
import { AddAppointmentModal, ServiceOption, StaffOption } from '../../components/AddAppointmentModal';


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

const INIT_COLS: StaffCol[] = [];

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
  const [cols, setCols] = useState<StaffCol[]>(INIT_COLS);
  const [shopId, setShopId] = useState<string | null>(null);
  const [shopSlug, setShopSlug] = useState<string | null>(null);
  const [barberList, setBarberList] = useState<{ id: string; name: string }[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [services, setServices] = useState<ServiceOption[]>([]);

  async function loadShopAndChildren() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: shopData, error: shopErr } = await supabase
      .from('shops')
      .select('id, slug')
      .or(`owner_user_id.eq.${user.id},owner_id.eq.${user.id}`)
      .maybeSingle();
    if (shopErr) { console.warn('[agenda] shops query error:', shopErr); return; }
    if (!shopData) return;
    setShopId(shopData.id);
    setShopSlug(shopData.slug);
    const { data: barbers, error: staffErr } = await supabase.from('staff').select('id, name').eq('shop_id', shopData.id).eq('is_active', true);
    if (staffErr) console.warn('[agenda] staff query error:', staffErr);
    setBarberList((barbers ?? []) as { id: string; name: string }[]);
    const { data: svcs, error: svcErr } = await supabase.from('services')
      .select('id, name, duration_min, price_cents')
      .eq('shop_id', shopData.id)
      .eq('is_active', true);
    if (svcErr) console.warn('[agenda] services query error:', svcErr);
    setServices((svcs ?? []).map((s: any) => ({
      id: s.id,
      label: s.name,
      dur: s.duration_min,
      price: `${Math.round(s.price_cents / 100)}₺`,
    })));
  }

  useEffect(() => { loadShopAndChildren(); }, []);

  // Refresh services + staff when the Add modal opens so new entries from
  // other screens (services, team) appear without restart.
  useEffect(() => {
    if (showAdd) loadShopAndChildren();
  }, [showAdd]);

  useEffect(() => {
    if (barberList.length) loadAgenda();
  }, [selectedDate, barberList]);

  async function loadAgenda() {
    const barbers = barberList;
    if (!barbers.length) { setCols([]); return; }

    const dayStart = new Date(selectedDate); dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(selectedDate); dayEnd.setDate(dayEnd.getDate()+1); dayEnd.setHours(0,0,0,0);

    // barbers already loaded — skip the redundant shop/barber fetch
    const _ = shopId; // referenced to avoid unused-var warning
    if (!barbers?.length) { setCols([]); return; }

    const [{ data: appts }, { data: blocks }] = await Promise.all([
      supabase.from('appointments').select('id, staff_id, customer_name, service_name, starts_at, duration_min, status')
        .in('staff_id', barbers.map((b: any) => b.id))
        .gte('starts_at', dayStart.toISOString()).lt('starts_at', dayEnd.toISOString())
        .neq('status', 'cancelled'),
      supabase.from('blocks').select('id, staff_id, starts_at, ends_at, reason')
        .in('staff_id', barbers.map((b: any) => b.id))
        .gte('starts_at', dayStart.toISOString()).lt('starts_at', dayEnd.toISOString()),
    ]);

    const now = new Date();
    const newCols: StaffCol[] = (barbers as any[]).map(barber => {
      const barberAppts = (appts ?? []).filter((a: any) => a.staff_id === barber.id);
      const barberBlocks = (blocks ?? []).filter((b: any) => b.staff_id === barber.id);

      const items: ColItem[] = [
        ...barberAppts.map((a: any) => {
          const start = new Date(a.starts_at);
          const end = new Date(start.getTime() + (a.duration_min ?? 30) * 60000);
          const state: AppState = a.status === 'completed' ? 'done'
            : (start <= now && now < end) ? 'active' : 'upcoming';
          return { type: 'appt' as const, id: a.id, time: formatTime(start), dur: a.duration_min ?? 30, name: a.customer_name, svc: a.service_name, state };
        }),
        ...barberBlocks.map((b: any) => {
          const start = new Date(b.starts_at);
          const end = new Date(b.ends_at);
          const dur = Math.round((end.getTime() - start.getTime()) / 60000);
          return { type: 'blok' as const, id: b.id, time: formatTime(start), dur, label: `BLOKE · ${translateReason(b.reason)}` };
        }),
      ].sort((a, b) => a.time.localeCompare(b.time));

      return {
        id: barber.id,
        name: barber.name,
        count: barberAppts.length,
        blok: barberBlocks.length,
        items,
      };
    });

    setCols(newCols);
  }

  function handleAddAppointment() {
    setShowAdd(true);
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
        }}
      />

      {/* Two-column horizontal scroll — flex:1, gap:12, padding:'20px 16px 90px' */}
      {cols.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Henüz personel veya randevu yok</Text>
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.colScroll}
        contentContainerStyle={styles.colContent}
      >
        {cols.map(col => (
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

      <AddAppointmentModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        services={services}
        staffList={barberList}
        onSave={async (data) => {
          if (!shopSlug) {
            Alert.alert('Hata', 'Dükkan bilgisi yüklenmedi. Sayfayı yenileyin.');
            return;
          }
          const { error: fnErr } = await supabase.functions.invoke('app-book-appointment', {
            body: {
              shop_slug: shopSlug,
              service_id: data.serviceId,
              staff_id: data.staffId,
              starts_at: `${data.date}T${data.time}:00`,
              customer_name: data.customerName,
              customer_phone: data.customerPhone || null,
            },
          });
          if (fnErr) {
            console.warn('[agenda] app-book-appointment error:', fnErr);
            const status = (fnErr as any)?.context?.status ?? 0;
            const ctxBody = (fnErr as any)?.context?.body;
            const ctxMsg = typeof ctxBody === 'string' ? ctxBody : '';
            let msg: string;
            if (status === 409) msg = 'Bu saat dolu. Başka bir saat seçin.';
            else if (status === 404) msg = 'Dükkan veya hizmet bulunamadı. Sayfayı yenileyin.';
            else if (status === 429) msg = 'Çok fazla deneme. Birkaç dakika bekleyin.';
            else if (status === 401) msg = 'Oturum gerekli. Tekrar giriş yapın.';
            else if (status === 400) msg = `Geçersiz bilgi: ${fnErr.message || ctxMsg || 'detay yok'}`;
            else msg = `Randevu eklenemedi (HTTP ${status || '?'}): ${fnErr.message || ctxMsg || 'bilinmeyen hata'}`;
            Alert.alert('Hata', msg);
            return;
          }
          setShowAdd(false);
          loadAgenda();
        }}
      />
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

  /* Empty screen state */
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[400],
    textAlign: 'center',
  },

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
