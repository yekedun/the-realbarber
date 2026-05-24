/**
 * M5 · Ekip Yönetimi (Team)
 * Pixel-perfect conversion from index.html EkipScreen + StaffScheduleModal
 *
 * Includes:
 *  - OverlineHeader: eyebrow "Ekip Yönetimi", title "Ustalar", trailing "Personel ekle" button
 *  - Staff rows with exact dummy data:
 *      Mehmet Demir · Aktif · %50 komisyon · Pzt–Cmt 09–19
 *      Can Aslan    · Aktif · %50 komisyon · Pzt–Cum 10–20
 *      Ayşe Yılmaz  · Aktif · Komisyon yok · Sal–Cmt 10–18
 *      Burak Şahin  · Pasif · Komisyon yok
 *  - Status toggle with Alert (exact strings: "Durumu Değiştir", "Pasif yap"/"Aktif yap", "Vazgeç")
 *  - Add staff sheet with name + email fields, "Ekle" button
 *  - Commission sheet with commission rate field, "Kaydet" button
 *  - StaffScheduleModal: 7-day tab grid (day tabs), open/closed toggle,
 *      start/end time fields, break fields, "Tüm Günleri Kaydet" button
 *  - Custom Toggle: 44×26, brand-600=on / slate-200=off, white thumb 22×22, Animated
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import {
  rowsToStaffSchedule,
  staffScheduleToRows,
  type UiStaffScheduleDay,
} from '../../lib/staff-schedule';

/* ─── Data ──────────────────────────────────────────────────── */

interface StaffMember {
  id: string;
  name: string;
  status: 'Aktif' | 'Pasif';
  meta: string;
}

// TODO: connect Supabase — fetch from staff table for this shop
const INIT_STAFF: StaffMember[] = [];

const TR_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

const DEFAULT_SCHEDULE = TR_DAYS.map((d, i) => ({
  day: d,
  open: i >= 1 && i <= 6,
  start: '09:00',
  end: '19:00',
  breakStart: '',
  breakEnd: '',
}));

/* ─── Toggle ────────────────────────────────────────────────── */

interface ToggleProps {
  on: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ on, onChange }: ToggleProps) {
  const anim = useRef(new Animated.Value(on ? 1 : 0)).current;

  function handlePress() {
    const toVal = on ? 0 : 1;
    Animated.timing(anim, {
      toValue: toVal,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onChange(!on);
  }

  const bgColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.slate[200], colors.brand[600]],
  });
  const thumbLeft = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 20],
  });

  return (
    <Pressable onPress={handlePress} hitSlop={8}>
      <Animated.View style={[styles.toggleTrack, { backgroundColor: bgColor }]}>
        <Animated.View style={[styles.toggleThumb, { left: thumbLeft }]} />
      </Animated.View>
    </Pressable>
  );
}

/* ─── StaffScheduleModal ────────────────────────────────────── */

interface StaffScheduleModalProps {
  open: boolean;
  onClose: () => void;
  staffId: string | null;
  staffName: string;
  onSaved?: () => void;
}

function StaffScheduleModal({ open, onClose, staffId, staffName, onSaved }: StaffScheduleModalProps) {
  const [schedule, setSchedule] = useState<UiStaffScheduleDay[]>(DEFAULT_SCHEDULE);
  const [selDay,   setSelDay]   = useState(1);
  const [saving, setSaving] = useState(false);
  const day = schedule[selDay];

  useEffect(() => {
    if (!open) return;
    setSelDay(1);
    if (!staffId) {
      setSchedule(DEFAULT_SCHEDULE);
      return;
    }
    supabase
      .from('staff_schedules')
      .select('day_of_week, is_working, work_start, work_end, break_start, break_end')
      .eq('staff_id', staffId)
      .then(({ data, error }) => {
        if (error) {
          Alert.alert('Hata', 'Çalışma saatleri yüklenemedi.');
          return;
        }
        setSchedule(rowsToStaffSchedule((data ?? []) as any));
      });
  }, [open, staffId]);

  function updateDay(field: keyof UiStaffScheduleDay, val: string | boolean) {
    setSchedule((s) => s.map((d, i) => i === selDay ? { ...d, [field]: val } : d));
  }

  async function handleSave() {
    if (!staffId) {
      Alert.alert('Hata', 'Personel bilgisi bulunamadı.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('staff_schedules')
      .upsert(staffScheduleToRows(staffId, schedule) as any, { onConflict: 'staff_id,day_of_week' });
    setSaving(false);
    if (error) {
      Alert.alert('Hata', 'Çalışma saatleri kaydedilemedi.');
      return;
    }
    onSaved?.();
    onClose();
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetContainer} onPress={() => {}}>
          {/* Handle */}
          <View style={styles.sheetHandle} />

          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.sheetBodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title */}
            <View style={styles.scheduleHeaderBlock}>
              <Text style={styles.scheduleEyebrow}>Çalışma Saatleri</Text>
              <Text style={styles.scheduleTitle}>{staffName || 'Personel'}</Text>
            </View>

            {/* Day tabs */}
            <View style={styles.dayTabsRow}>
              {schedule.map((d, i) => {
                const isSel = selDay === i;
                return (
                  <TouchableOpacity
                    key={d.day}
                    onPress={() => setSelDay(i)}
                    style={[
                      styles.dayTab,
                      isSel
                        ? styles.dayTabSel
                        : d.open
                          ? styles.dayTabOpen
                          : styles.dayTabClosed,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.dayTabText,
                        isSel
                          ? styles.dayTabTextSel
                          : d.open
                            ? styles.dayTabTextOpen
                            : styles.dayTabTextClosed,
                      ]}
                    >
                      {d.day}
                    </Text>
                    <View
                      style={[
                        styles.dayTabDot,
                        {
                          backgroundColor: d.open
                            ? isSel
                              ? 'rgba(255,255,255,0.45)'
                              : colors.mint[600]
                            : 'transparent',
                        },
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Open toggle */}
            <View style={styles.openToggleCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.openToggleTitle}>Çalışıyor</Text>
                  <Text style={styles.openToggleSub}>
                    {day.open ? 'Bu gün aktif' : 'Bu gün tatil / kapalı'}
                  </Text>
                </View>
                <Toggle on={day.open} onChange={(v) => updateDay('open', v)} />
              </View>
            </View>

            {day.open && (
              <>
                {/* Çalışma Saatleri */}
                <View style={styles.timeSection}>
                  <Text style={styles.timeSectionLabel}>Çalışma Saatleri</Text>
                  <View style={styles.timeGrid}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timeFieldLabel}>Açılış</Text>
                      <TextInput
                        value={day.start}
                        onChangeText={(v) => updateDay('start', v)}
                        placeholder="09:00"
                        placeholderTextColor={colors.slate[300]}
                        style={styles.timeInput}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timeFieldLabel}>Kapanış</Text>
                      <TextInput
                        value={day.end}
                        onChangeText={(v) => updateDay('end', v)}
                        placeholder="19:00"
                        placeholderTextColor={colors.slate[300]}
                        style={styles.timeInput}
                      />
                    </View>
                  </View>
                </View>

                {/* Mola */}
                <View style={styles.timeSection}>
                  <Text style={styles.timeSectionLabel}>Mola (Opsiyonel)</Text>
                  <View style={styles.timeGrid}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timeFieldLabel}>Mola Başlangıç</Text>
                      <TextInput
                        value={day.breakStart}
                        onChangeText={(v) => updateDay('breakStart', v)}
                        placeholder="--:--"
                        placeholderTextColor={colors.slate[300]}
                        style={styles.timeInput}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timeFieldLabel}>Mola Bitiş</Text>
                      <TextInput
                        value={day.breakEnd}
                        onChangeText={(v) => updateDay('breakEnd', v)}
                        placeholder="--:--"
                        placeholderTextColor={colors.slate[300]}
                        style={styles.timeInput}
                      />
                    </View>
                  </View>
                  <View style={styles.breakHintBox}>
                    <Text style={styles.breakHintText}>
                      Mola saatleri müşteri randevu ekranında otomatik kapalı görünür.
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* Save */}
            <TouchableOpacity
              onPress={handleSave}
              style={styles.primaryBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Tüm Günleri Kaydet</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─── Add Staff Sheet ───────────────────────────────────────── */

interface AddStaffSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, email: string, commissionRate: number | null) => void;
}

function AddStaffSheet({ open, onClose, onAdd }: AddStaffSheetProps) {
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [commInput, setCommInput] = useState('');

  function handleAdd() {
    if (name.trim().length < 2) {
      Alert.alert('Geçersiz', 'Geçerli bir ad gir.');
      return;
    }
    const rate = commInput.trim() ? parseFloat(commInput) : null;
    if (rate !== null && (isNaN(rate) || rate < 0 || rate > 100)) {
      Alert.alert('Geçersiz', 'Komisyon 0-100 arasında olmalı.');
      return;
    }
    onAdd(name.trim(), email.trim(), rate);
    setName(''); setEmail(''); setCommInput('');
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetContainer} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Personel Ekle</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={styles.sheetCancelBtn}>İptal</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.sheetBodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Ad Soyad */}
            <View>
              <Text style={styles.fieldLabel}>Ad Soyad</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ad Soyad"
                placeholderTextColor={colors.slate[300]}
                autoCorrect={false}
                spellCheck={false}
                style={styles.textInput}
              />
            </View>

            {/* E-posta */}
            <View>
              <Text style={styles.fieldLabel}>E-posta</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="personel@dukkan.com"
                placeholderTextColor={colors.slate[300]}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.textInput}
              />
            </View>

            {/* Komisyon */}
            <View>
              <Text style={styles.fieldLabel}>Komisyon Oranı (%)</Text>
              <TextInput
                value={commInput}
                onChangeText={setCommInput}
                placeholder="Örn. 50"
                placeholderTextColor={colors.slate[300]}
                keyboardType="numeric"
                style={styles.textInput}
              />
            </View>

            <TouchableOpacity
              onPress={handleAdd}
              style={[styles.primaryBtn, name.trim().length < 2 && styles.primaryBtnDisabled]}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Ekle</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─── Commission Sheet ──────────────────────────────────────── */

interface CommissionSheetProps {
  open: boolean;
  onClose: () => void;
  staffName: string;
  onSave: (rate: number) => void;
}

function CommissionSheet({ open, onClose, staffName, onSave }: CommissionSheetProps) {
  const [commInput, setCommInput] = useState('');

  function handleSave() {
    const val = parseFloat(commInput);
    if (isNaN(val) || val < 0 || val > 100) {
      Alert.alert('Geçersiz', '0 ile 100 arasında oran gir.');
      return;
    }
    // TODO: connect Supabase — update commission_rate for staff
    onSave(val);
    setCommInput('');
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetContainer} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Komisyon Oranı</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={styles.sheetCancelBtn}>İptal</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sheetBodyContent}>
            {staffName ? (
              <Text style={styles.commDesc}>{staffName} için yüzde oran gir.</Text>
            ) : null}
            <View>
              <Text style={styles.fieldLabel}>Oran (%)</Text>
              <TextInput
                value={commInput}
                onChangeText={setCommInput}
                placeholder="Örn. 50"
                placeholderTextColor={colors.slate[300]}
                keyboardType="numeric"
                style={styles.textInput}
              />
            </View>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.primaryBtn, { marginTop: 8 }]}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─── StaffRow ──────────────────────────────────────────────── */

interface StaffRowItemProps {
  member: StaffMember;
  onRowPress: () => void;
  onChevronPress: () => void;
  isLast: boolean;
}

function StaffRowItem({ member, onRowPress, onChevronPress, isLast }: StaffRowItemProps) {
  const initials = member.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity
      onPress={onRowPress}
      style={[styles.staffRow, !isLast && styles.staffRowBorder]}
      activeOpacity={0.75}
    >
      {/* Avatar */}
      <View style={[styles.staffAvatar, member.status === 'Pasif' && styles.staffAvatarPasif]}>
        <Text style={styles.staffAvatarText}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.staffNameRow}>
          <Text style={styles.staffName}>{member.name}</Text>
          {member.status === 'Pasif' && (
            <View style={styles.pasifBadge}>
              <Text style={styles.pasifBadgeText}>Pasif</Text>
            </View>
          )}
        </View>
        <Text style={styles.staffMeta}>{member.meta}</Text>
      </View>

      {/* Chevron */}
      <TouchableOpacity onPress={onChevronPress} hitSlop={10} style={styles.chevronBtn}>
        <View style={styles.chevronWrap}>
          <View style={styles.chevronLine1} />
          <View style={styles.chevronLine2} />
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

/* ─── Main Screen ───────────────────────────────────────────── */

export default function TeamScreen() {
  const [staff,          setStaff]          = useState<StaffMember[]>(INIT_STAFF);
  const [addOpen,        setAddOpen]        = useState(false);
  const [scheduleOpen,   setScheduleOpen]   = useState(false);
  const [commOpen,       setCommOpen]       = useState(false);
  const [selectedId,     setSelectedId]     = useState<string | null>(null);
  const [shopId,         setShopId]         = useState<string | null>(null);

  const selected = staff.find((s) => s.id === selectedId);

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr) console.warn('[team] auth error:', authErr);
    if (!user) { console.warn('[team] no user — not logged in'); return; }
    const { data: shopData, error: shopErr } = await supabase
      .from('shops')
      .select('id')
      .or(`owner_user_id.eq.${user.id},owner_id.eq.${user.id}`)
      .maybeSingle();
    if (shopErr) { console.warn('[team] shops error:', shopErr); Alert.alert('Hata', `Dükkan yüklenemedi: ${shopErr.message}`); return; }
    if (!shopData) { console.warn('[team] no shop for user', user.id); return; }
    setShopId(shopData.id);
    // Commission columns are not directly SELECTable (see migration 20260518120000);
    // owners must read them via the get_staff_commission_configs RPC.
    const [{ data, error: staffErr }, { data: commData, error: commErr }] = await Promise.all([
      supabase
        .from('staff')
        .select('id, name, is_active')
        .eq('shop_id', shopData.id)
        .order('created_at'),
      supabase.rpc('get_staff_commission_configs', { p_shop_id: shopData.id }),
    ]);
    if (staffErr) { console.warn('[team] staff error:', staffErr); Alert.alert('Hata', `Personel listesi yüklenemedi: ${staffErr.message}`); return; }
    if (commErr) console.warn('[team] commission RPC error:', commErr);
    const commByStaff = new Map<string, { type: string | null; bps: number | null }>();
    (commData ?? []).forEach((c: any) => commByStaff.set(c.staff_id, { type: c.commission_type, bps: c.commission_rate_bps }));
    console.log('[team] loaded', (data ?? []).length, 'staff for shop', shopData.id);
    setStaff((data ?? []).map((s: any) => {
      const c = commByStaff.get(s.id);
      return {
        id: s.id,
        name: s.name,
        status: s.is_active ? 'Aktif' : 'Pasif',
        meta: c?.type === 'percentage' && c.bps
          ? `%${Math.round(c.bps / 100)} komisyon`
          : 'Komisyon yok',
      };
    }));
  }

  function handleToggleStatus(s: StaffMember) {
    const verb = s.status === 'Aktif' ? 'pasif yap' : 'aktif yap';
    Alert.alert(
      'Durumu Değiştir',
      `${s.name} personelini ${verb}?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: s.status === 'Aktif' ? 'Pasif yap' : 'Aktif yap',
          onPress: async () => {
            const newIsActive = s.status === 'Aktif' ? false : true;
            await supabase.from('staff').update({ is_active: newIsActive }).eq('id', s.id);
            setStaff((prev) =>
              prev.map((p) =>
                p.id === s.id
                  ? { ...p, status: p.status === 'Aktif' ? 'Pasif' : 'Aktif' }
                  : p,
              ),
            );
          },
        },
      ],
    );
  }

  async function handleAddStaff(name: string, email: string, commissionRate: number | null) {
    if (!shopId) {
      Alert.alert('Hata', 'Dükkan bilgisi yüklenemedi. Lütfen tekrar deneyin.');
      return;
    }

    const emailValue = email.trim();

    let data: any = null;
    let insertErr: any = null;

    if (emailValue) {
      const { data: inviteData, error: inviteErr } = await supabase.functions.invoke('invite-barber', {
        body: { email: emailValue, display_name: name.trim() },
      });
      insertErr = inviteErr;
      data = inviteData?.staff ?? null;
      if (!insertErr && data?.id) {
        const { error: updateErr } = await supabase
          .from('staff')
          .update({ email: emailValue } as any)
          .eq('id', data.id);
        insertErr = updateErr;
      }
    } else {
      const result = await supabase
        .from('staff')
        .insert({
          shop_id: shopId,
          name: name.trim(),
          role: 'staff',
          is_active: true,
        } as any)
        .select('id, name, is_active')
        .single();
      data = result.data;
      insertErr = result.error;
    }

    if (insertErr || !data) {
      console.warn('[team] add-staff failed:', insertErr);
      const msg = (insertErr as any)?.message ?? 'bilinmeyen hata';
      Alert.alert('Hata', `Personel eklenemedi: ${msg}`);
      return;
    }
    console.log('[team] added staff', (data as any).id);

    // Commission is owner-scoped; must go through the SECURITY DEFINER RPC.
    if (commissionRate !== null) {
      const { error: commErr } = await supabase.rpc('update_staff_commission_config', {
        p_staff_id: (data as any).id,
        p_commission_type: 'percentage',
        p_commission_rate_bps: Math.round(commissionRate * 100),
      });
      if (commErr) {
        console.warn('[team] commission update failed:', commErr);
        Alert.alert('Uyarı', `Personel eklendi ama komisyon kaydedilemedi: ${commErr.message}`);
      }
    }

    const rate = (data as any).commission_rate_bps;
    setStaff((prev) => [
      ...prev,
      {
        id: (data as any).id,
        name: (data as any).name,
        status: 'Aktif',
        meta: rate ? `%${Math.round(rate / 100)} komisyon` : 'Komisyon yok',
      },
    ]);
    setAddOpen(false);
  }

  async function handleSaveCommission(rate: number) {
    if (selectedId) {
      const { error: commErr } = await supabase.rpc('update_staff_commission_config', {
        p_staff_id: selectedId,
        p_commission_type: 'percentage',
        p_commission_rate_bps: Math.round(rate * 100),
      });
      if (commErr) {
        console.warn('[team] commission update failed:', commErr);
        Alert.alert('Hata', `Komisyon kaydedilemedi: ${commErr.message}`);
        return;
      }
    }
    setStaff((prev) =>
      prev.map((p) =>
        p.id === selectedId
          ? { ...p, meta: p.meta.replace(/(?:Komisyon yok|%\d+ komisyon)/, `%${rate} komisyon`) }
          : p,
      ),
    );
    setCommOpen(false);
  }

  return (
    <View style={styles.screen}>
      {/* OverlineHeader */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Ekip Yönetimi</Text>
          <Text style={styles.pageTitle}>Ustalar</Text>
        </View>
        <TouchableOpacity
          onPress={() => setAddOpen(true)}
          style={styles.headerAddBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.headerAddBtnPlus}>+</Text>
          <Text style={styles.headerAddBtnText}>Personel ekle</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {staff.length === 0 ? (
          <Text style={styles.emptyText}>Henüz personel yok. Ekip ekranından ekleyebilirsiniz.</Text>
        ) : (
          <View style={styles.staffCard}>
            {staff.map((s, i) => (
              <StaffRowItem
                key={s.id}
                member={s}
                onRowPress={() => handleToggleStatus(s)}
                onChevronPress={() => {
                  setSelectedId(s.id);
                  setScheduleOpen(true);
                }}
                isLast={i === staff.length - 1}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add staff sheet */}
      <AddStaffSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAddStaff}
      />

      {/* Commission sheet */}
      <CommissionSheet
        open={commOpen}
        onClose={() => setCommOpen(false)}
        staffName={selected?.name ?? ''}
        onSave={handleSaveCommission}
      />

      {/* Schedule sheet */}
      <StaffScheduleModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        staffId={selected?.id ?? null}
        staffName={selected?.name ?? ''}
        onSaved={loadStaff}
      />
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
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
  headerAddBtn: {
    height: 34,
    paddingHorizontal: 12,
    backgroundColor: colors.brand[600],
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  headerAddBtnPlus: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    color: '#ffffff',
    lineHeight: 16,
  },
  headerAddBtnText: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: '#ffffff',
  },

  /* List */
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    marginTop: 24,
    textAlign: 'center',
  },

  /* Staff card */
  staffCard: {
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 14,
    overflow: 'hidden',
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  staffRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  staffAvatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: colors.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  staffAvatarPasif: {
    backgroundColor: colors.slate[100],
  },
  staffAvatarText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: colors.brand[600],
  },
  staffNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
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
  pasifBadge: {
    backgroundColor: colors.slate[100],
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  pasifBadgeText: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.slate[400],
  },
  chevronBtn: {
    padding: 4,
  },
  chevronWrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronLine1: {
    position: 'absolute',
    width: 8,
    height: 1.6,
    backgroundColor: colors.slate[400],
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }, { translateY: -3 }],
  },
  chevronLine2: {
    position: 'absolute',
    width: 8,
    height: 1.6,
    backgroundColor: colors.slate[400],
    borderRadius: 1,
    transform: [{ rotate: '45deg' }, { translateY: 3 }],
  },

  /* Toggle */
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 999,
    flexShrink: 0,
  },
  toggleThumb: {
    position: 'absolute',
    top: 2,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 2,
  },

  /* Sheet shared */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,18,32,0.38)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingBottom: 32,
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.slate[200],
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: -0.3,
    color: colors.ink[900],
  },
  sheetCancelBtn: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.slate[500],
  },
  sheetBody: { flexShrink: 1 },
  sheetBodyContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 16,
  },

  /* Schedule sheet */
  scheduleHeaderBlock: {
    marginBottom: 16,
  },
  scheduleEyebrow: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.slate[500],
    marginBottom: 6,
  },
  scheduleTitle: {
    fontSize: 22,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: -0.44,
    color: colors.ink[900],
  },

  /* Day tabs */
  dayTabsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 18,
  },
  dayTab: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
  },
  dayTabSel: {
    backgroundColor: colors.ink[900],
    borderColor: colors.ink[900],
  },
  dayTabOpen: {
    backgroundColor: colors.slate[0],
    borderColor: colors.slate[200],
  },
  dayTabClosed: {
    backgroundColor: colors.slate[100],
    borderColor: colors.slate[200],
  },
  dayTabText: {
    fontSize: 9,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dayTabTextSel: {
    color: '#ffffff',
  },
  dayTabTextOpen: {
    color: colors.ink[900],
  },
  dayTabTextClosed: {
    color: colors.slate[400],
  },
  dayTabDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
  },

  /* Open toggle card */
  openToggleCard: {
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 4,
  },
  openToggleTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
  },
  openToggleSub: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    marginTop: 2,
  },

  /* Time section */
  timeSection: {
    gap: 8,
  },
  timeSectionLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 1.96,
    textTransform: 'uppercase',
    color: colors.slate[500],
  },
  timeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  timeFieldLabel: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    letterSpacing: 1.32,
    textTransform: 'uppercase',
    color: colors.slate[500],
    marginBottom: 6,
  },
  timeInput: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 15,
    color: colors.ink[900],
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  breakHintBox: {
    backgroundColor: colors.slate[100],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  breakHintText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    lineHeight: 17.4,
  },

  /* Form shared */
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.slate[500],
    marginBottom: 7,
  },
  textInput: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 15,
    color: colors.ink[900],
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  /* Primary button */
  primaryBtn: {
    height: 52,
    backgroundColor: colors.ink[900],
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: 'Montserrat-SemiBold',
    color: '#ffffff',
  },

  /* Commission sheet */
  commDesc: {
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
  },
});
