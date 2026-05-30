/**
 * AddAppointmentModal
 * Source: screens.jsx → AddAppointmentSheet (used in AjandaScreen / RandevularScreen)
 *
 * Structure (exact from source):
 *   Modal (slide, pageSheet)
 *   SafeAreaView bg slate-50
 *   ├─ Header bar:
 *   │   "İptal"          left ghost button  (15px Regular brand-600, border 0)
 *   │   "Randevu Ekle"   title              (source title="Yeni Randevu", label corrected to "Randevu Ekle")
 *   │   "Kaydet"         right ghost button (15px SemiBold brand-600)
 *   └─ ScrollView (paddingHorizontal 20, paddingTop 20, paddingBottom 48)
 *       TextField  label="Müşteri Adı"  placeholder="Örn. Ahmet Yılmaz"
 *       TextField  label="Telefon"      placeholder="0(5xx) xxx xx xx"
 *       SectionLabel "Hizmet"
 *       Service rows — touchable, selection state:
 *         { id: 'sac',       label: 'Saç kesim',    dur: 30, price: '200₺' }
 *         { id: 'sakal',     label: 'Sakal tıraşı', dur: 20, price: '120₺' }
 *         { id: 'sac-sakal', label: 'Saç + Sakal',  dur: 45, price: '280₺' }
 *         Row: border 1px sel=ink-900 unsel=slate-200, bg sel=ink-900 unsel=slate-0
 *         borderRadius 12, padding '12px 14px', flex row, justifyContent space-between
 *         Left: 14px SemiBold; Right: 12px opacity sel=0.8 unsel=0.55
 *       Duration hint (when service selected):
 *         "Süre seçilen hizmetten gelir: {dur} dk" (12px Regular slate-500 marginTop 6)
 *       SectionLabel "Tarih"
 *       DayPicker (inline, reuses screen-level component)
 *       SectionLabel "Saat"
 *       Time slot grid (4 cols, gap 6):
 *         Times: 09:00 09:30 10:00 10:30 11:00 11:30 12:00 12:30
 *                13:00 13:30 14:00 14:30 15:00 15:30 16:00 16:30 17:00 17:30
 *         Each: height 38, borderRadius 8, sel=ink-900 bg, unsel=slate-0
 *         13px SemiBold tabular-nums
 *       ÖZET summary card (shown when slot selected):
 *         bg slate-100, borderRadius 12, padding 14
 *         overline "Özet" (11px SemiBold 0.16em uppercase slate-500)
 *         main "{curSvc.label} · {dateLabel} · {slot}" (14px SemiBold marginTop 6 ink-900)
 *         sub  "Bitiş: {endTime} ({curSvc.dur} dk)"   (12px Regular fg-3 marginTop 4)
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { User } from 'lucide-react-native';
import { colors } from '../lib/theme';
import { ContactPickerSheet } from './ContactPickerSheet';
import {
  getInitialAppointmentServiceId,
  isAppointmentModalSaveEnabled,
  resolveAppointmentServiceId,
} from '../lib/appointment-modal-state';
import {
  AppointmentWorkingHours,
  formatLocalAppointmentDate,
  generateAppointmentTimesForDate,
} from '../lib/appointment-time';

// TODO: connect Supabase — fetch services for this shop: supabase.from('services').select('*').eq('shop_id', shopId).eq('is_active', true)
// TODO: connect Supabase — on Kaydet, insert appointment: supabase.from('appointments').insert({ ... })

/* ── Design-source service options ─────────────────────────────── */
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

const DEFAULT_SERVICES: ServiceOption[] = [
  { id: 'sac',       label: 'Saç kesim',    dur: 30, price: '200₺' },
  { id: 'sakal',     label: 'Sakal tıraşı', dur: 20, price: '120₺' },
  { id: 'sac-sakal', label: 'Saç + Sakal',  dur: 45, price: '280₺' },
];

/* ── Time slots — exact from source ADD_TIMES ───────────────────── */

/* ── Turkish month abbreviations ────────────────────────────────── */
const TR_MON_S2 = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'] as const;
const TR_DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

function addMins(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/* ── Inline DayPicker (same logic as screens.jsx DayPicker) ─────── */
function InlineDayPicker({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (idx: number) => void;
}) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
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

/* ── Props ──────────────────────────────────────────────────────── */
export interface AddAppointmentModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    customerName: string;
    customerPhone: string;
    serviceId: string;
    staffId: string | null;
    date: string;
    time: string;
    notes?: string;
  }) => void;
  /** Services to display in the selector. Defaults to the design mock data. */
  services?: ServiceOption[];
  staffList?: StaffOption[];
  initialStaffId?: string | null;
  workingHours?: AppointmentWorkingHours | null;
  /** Sunucu zamanı (ms). Geçmiş slot filtrelemesinde cihaz saati yerine kullanılır. */
  serverNowMs?: number;
  /** Son müşteri önerilerini doldurmak için kullanılır. */
  shopId?: string | null;
}

/* ── MODAL ──────────────────────────────────────────────────────── */
export function AddAppointmentModal({
  visible,
  onClose,
  onSave,
  services = DEFAULT_SERVICES,
  staffList,
  initialStaffId,
  workingHours,
  serverNowMs,
  shopId,
}: AddAppointmentModalProps) {
  const [name,           setName]           = useState('');
  const [phone,          setPhone]          = useState('');
  const [notes,          setNotes]          = useState('');
  const [svc,            setSvc]            = useState<string | null>(() => getInitialAppointmentServiceId(services));
  const [dayIdx,         setDayIdx]         = useState(0);              // index 0 = today
  const [slot,           setSlot]           = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(initialStaffId ?? null);
  const [pickerVisible,  setPickerVisible]  = useState(false);

  useEffect(() => {
    if (visible) setSelectedStaffId(initialStaffId ?? null);
  }, [visible, initialStaffId]);

  useEffect(() => {
    if (!visible) return;
    setSvc((current) => resolveAppointmentServiceId(current, services));
    setNotes('');
  }, [visible, services]);

  const curSvc  = services.find(s => s.id === svc);
  const canSave = isAppointmentModalSaveEnabled({
    customerName: name,
    slot,
    serviceId: svc,
    staffListHasItems: !!(staffList && staffList.length > 0),
    selectedStaffId,
  });

  /* Build date label for ÖZET card */
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []); // days array is always relative to today at mount — stable within modal session

  const selDate = days[dayIdx];

  const dateLabel = useMemo(
    () => `${selDate.getDate()} ${TR_MON_S2[selDate.getMonth()]}`,
    [selDate],
  );

  const endTime = useMemo(
    () => (slot && curSvc ? addMins(slot, curSvc.dur) : null),
    [slot, curSvc],
  );

  const timeSlots = useMemo(
    () => generateAppointmentTimesForDate(selDate, workingHours, curSvc?.dur ?? 30, serverNowMs),
    [selDate, workingHours, curSvc, serverNowMs],
  );

  function handleSave() {
    if (!canSave) return;
    if (!svc) return;
    const trimmedNotes = notes.trim();
    onSave({
      customerName: name.trim(),
      customerPhone: phone,
      serviceId: svc,
      staffId: selectedStaffId,
      date: formatLocalAppointmentDate(selDate),
      time: slot,
      ...(trimmedNotes ? { notes: trimmedNotes } : {}),
    });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        {/* ── Header bar ───────────────────────────────────────────
            İptal (left, ghost, brand-600 text) | Randevu Ekle (title) | Kaydet (right, SemiBold brand-600) */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.headerGhost}>İptal</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Randevu Ekle</Text>
          <TouchableOpacity onPress={handleSave} activeOpacity={canSave ? 0.7 : 1}>
            <Text style={[styles.headerSave, !canSave && styles.headerSaveDisabled]}>Kaydet</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Müşteri Adı ────────────────────────────────────── */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Müşteri Adı</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Örn. Ahmet Yılmaz"
              placeholderTextColor={colors.slate[300]}
              autoCorrect={false}
              spellCheck={false}
            />
          </View>

          {/* ── Telefon ────────────────────────────────────────── */}
          <View style={[styles.fieldWrap, styles.fieldGap]}>
            <Text style={styles.fieldLabel}>Telefon</Text>
            <View style={styles.phoneRow}>
              <TextInput
                style={[styles.textInput, styles.phoneInput]}
                value={phone}
                onChangeText={setPhone}
                placeholder="0(5xx) xxx xx xx"
                placeholderTextColor={colors.slate[300]}
                keyboardType="phone-pad"
              />
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => setPickerVisible(true)}
                activeOpacity={0.7}
                hitSlop={8}
              >
                <User size={18} color={colors.brand[600]} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Not ────────────────────────────────────────────── */}
          <View style={[styles.fieldWrap, styles.fieldGap]}>
            <Text style={styles.fieldLabel}>Not (opsiyonel)</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Özel istek veya hatırlatma…"
              placeholderTextColor={colors.slate[300]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* ── Berber picker (shown when staffList is provided) ── */}
          {staffList && staffList.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Berber</Text>
              <View style={styles.serviceList}>
                {staffList.map(s => {
                  const sel = selectedStaffId === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => setSelectedStaffId(s.id)}
                      activeOpacity={0.8}
                      style={[styles.serviceRow, sel ? styles.serviceRowActive : styles.serviceRowInactive]}
                    >
                      <Text style={[styles.serviceLabel, sel && styles.serviceLabelActive]}>
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
          {staffList && staffList.length === 0 && (
            <Text style={styles.emptyHint}>
              Aktif personel bulunamadı. Önce Ekip ekranından en az bir personel ekleyin.
            </Text>
          )}

          {/* ── Hizmet section label ────────────────────────────── */}
          <Text style={styles.sectionLabel}>Hizmet</Text>

          {/* Service selector rows:
              border 1px sel=ink-900 unsel=slate-200
              bg sel=ink-900 unsel=slate-0
              borderRadius 12, padding '12px 14px', flex row, justifyContent space-between
              Left: 14px SemiBold; Right: 12px opacity sel=0.8 unsel=0.55 */}
          <View style={styles.serviceList}>
            {services.length === 0 ? (
              <Text style={styles.emptyHint}>
                Aktif hizmet bulunamadı. Önce Hizmetler ekranından en az bir aktif hizmet ekleyin.
              </Text>
            ) : services.map(o => {
              const sel = svc === o.id;
              return (
                <TouchableOpacity
                  key={o.id}
                  onPress={() => setSvc(o.id)}
                  activeOpacity={0.8}
                  style={[styles.serviceRow, sel ? styles.serviceRowActive : styles.serviceRowInactive]}
                >
                  <Text style={[styles.serviceLabel, sel && styles.serviceLabelActive]}>
                    {o.label}
                  </Text>
                  <Text style={[styles.serviceMeta, sel ? styles.serviceMetaActive : styles.serviceMetaInactive]}>
                    {o.dur} dk · {o.price}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Duration hint when service selected:
              "Süre seçilen hizmetten gelir: {dur} dk" (12px Regular slate-500 marginTop 6) */}
          {curSvc && (
            <Text style={styles.durationHint}>
              Süre seçilen hizmetten gelir: {curSvc.dur} dk
            </Text>
          )}

          {/* ── Tarih section label ────────────────────────────── */}
          <Text style={styles.sectionLabel}>Tarih</Text>

          {/* Inline DayPicker */}
          <InlineDayPicker
            selected={dayIdx}
            onSelect={idx => { setDayIdx(idx); setSlot(''); }}
          />

          {/* ── Saat section label ─────────────────────────────── */}
          <Text style={styles.sectionLabel}>Saat</Text>

          {/* Time slot grid: 4 cols, gap 6
              Each: height 38, borderRadius 8, sel=ink-900 bg, unsel=slate-0
              13px SemiBold tabular-nums */}
          <View style={styles.timeGrid}>
            {timeSlots.map(t => {
              const sel = slot === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setSlot(t)}
                  activeOpacity={0.8}
                  style={[styles.timeCell, sel ? styles.timeCellActive : styles.timeCellInactive]}
                >
                  <Text style={[styles.timeCellText, sel && styles.timeCellTextActive]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── ÖZET summary card (shown when slot selected) ──────
              bg slate-100, borderRadius 12, padding 14
              overline "Özet" (11px SemiBold 0.16em uppercase slate-500)
              main "{label} · {dateLabel} · {slot}" (14px SemiBold marginTop 6 ink-900)
              sub  "Bitiş: {endTime} ({dur} dk)"     (12px Regular fg-3 marginTop 4) */}
          {slot && curSvc && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryOverline}>Özet</Text>
              <Text style={styles.summaryMain}>
                {curSvc.label} · {dateLabel} · {slot}
              </Text>
              <Text style={styles.summarySub}>
                Bitiş: {endTime} ({curSvc.dur} dk)
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <ContactPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        shopId={shopId}
        onSelect={(contactName, contactPhone) => {
          setPhone(contactPhone);
          if (!name.trim()) setName(contactName);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },

  /* ── Header bar ──────────────────────────────────────────────────
     flex row, justifyContent space-between, alignItems center
     paddingHorizontal 16, paddingVertical 12
     borderBottom 1px slate-200 */
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
  },
  /* "İptal" — left ghost button: 15px Regular brand-600 */
  headerGhost: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 15,
    color: colors.brand[600],
  },
  /* "Randevu Ekle" title: 17px Bold ink-900 */
  headerTitle: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 17,
    color: colors.ink[900],
  },
  /* "Kaydet" — right save button: 15px SemiBold brand-600 */
  headerSave: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 15,
    color: colors.brand[600],
  },
  headerSaveDisabled: {
    opacity: 0.35,
  },

  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
  },

  /* ── TextField ───────────────────────────────────────────────────
     Source (components.jsx TextField):
     label: 11px SemiBold 0.16em uppercase slate-500
     input: bg slate-0, border slate-200, borderRadius 12, padding '12px 14px'
            fontSize 15 Regular ink-900 */
  fieldWrap: {},
  fieldGap: { marginTop: 16 },
  fieldLabel: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 11 * 0.16,
    textTransform: 'uppercase',
    color: colors.slate[500],
    marginBottom: 6,
  },
  textInput: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 15,
    color: colors.ink[900],
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  notesInput: {
    height: 72,
    paddingTop: 10,
  },

  /* Phone field row: input + contact picker button */
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  phoneInput: {
    flex: 1,
  },
  contactBtn: {
    width: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.slate[0],
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── SectionLabel ────────────────────────────────────────────────
     Source: components.jsx SectionLabel
     11px SemiBold 0.16em uppercase slate-500
     padding '0 20px', margin '24px 0 10px'
     Here inside a padded container so paddingHorizontal=0 */
  sectionLabel: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 11 * 0.16,
    textTransform: 'uppercase',
    color: colors.slate[500],
    marginTop: 24,
    marginBottom: 8,
  },

  /* ── Service selector ────────────────────────────────────────────
     flex col gap 6 */
  serviceList: {
    gap: 6,
  },
  /* Service row:
     borderRadius 12, padding '12px 14px', flex row, justifyContent space-between, alignItems baseline
     border 1px: sel=ink-900, unsel=slate-200
     bg: sel=ink-900, unsel=slate-0 */
  serviceRow: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderWidth: 1,
  },
  serviceRowActive: {
    borderColor: colors.ink[900],
    backgroundColor: colors.ink[900],
  },
  serviceRowInactive: {
    borderColor: colors.slate[200],
    backgroundColor: colors.slate[0],
  },
  /* Service label: 14px SemiBold */
  serviceLabel: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 14,
    color: colors.ink[900],
  },
  serviceLabelActive: { color: '#ffffff' },
  /* Service meta: 12px Regular opacity sel=0.8 unsel=0.55 */
  serviceMeta: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 12,
  },
  serviceMetaActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  serviceMetaInactive: {
    color: colors.slate[500],
    opacity: 0.55,
  },

  /* Duration hint: 12px Regular slate-500 marginTop 6 */
  durationHint: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 12,
    color: colors.slate[500],
    marginTop: 6,
  },
  emptyHint: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    color: colors.slate[500],
    backgroundColor: colors.slate[100],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    lineHeight: 18,
  },

  /* ── Inline DayPicker ────────────────────────────────────────────
     Same as screens.jsx DayPicker: gap 6, paddingHorizontal 16
     No horizontal padding here since we're already inside paddingHorizontal:20 scroll */
  dayPickerContent: {
    gap: 6,
  },
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
    letterSpacing: 10 * 0.12,
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

  /* ── Time grid: flexWrap row, 4 cols, gap 6 ──────────────────── */
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  /* Each time cell: height 38, borderRadius 8, ~1/4 width accounting for 3 gaps of 6px */
  timeCell: {
    width: '22.5%',
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeCellActive: {
    backgroundColor: colors.ink[900],
    borderColor: colors.ink[900],
  },
  timeCellInactive: {
    backgroundColor: colors.slate[0],
    borderColor: colors.slate[200],
  },
  /* 13px SemiBold tabular-nums */
  timeCellText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 13,
    color: colors.ink[900],
  },
  timeCellTextActive: { color: '#ffffff' },

  /* ── ÖZET summary card ───────────────────────────────────────────
     bg slate-100, borderRadius 12, padding 14, marginTop (from sectionLabel gap) */
  summaryCard: {
    backgroundColor: colors.slate[100],
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  /* overline "Özet": 11px SemiBold 0.16em uppercase slate-500 */
  summaryOverline: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 11 * 0.16,
    textTransform: 'uppercase',
    color: colors.slate[500],
  },
  /* main line: 14px SemiBold marginTop 6 ink-900 */
  summaryMain: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 14,
    color: colors.ink[900],
    marginTop: 6,
  },
  /* sub line: 12px Regular fg-3 marginTop 4 */
  summarySub: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 12,
    color: colors.slate[500],
    marginTop: 4,
  },
});
