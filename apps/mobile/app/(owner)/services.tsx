/**
 * M28 · Hizmet Yönetimi (Services)
 * Pixel-perfect conversion from screen-28-hizmetler.html
 *
 * Includes:
 *  - Color status dot per row (8×8, mint-600=active, slate-300=inactive)
 *  - Service name: fontSize 15, Montserrat-SemiBold
 *  - Duration badge PILL: slate-100 bg, slate-200 border, borderRadius 999, padding 2h 8v, fontSize 11
 *  - Price badge PILL: ink-900 bg, white text, borderRadius 999, fontSize 11 Bold
 *  - "Pasif" badge PILL when inactive: slate-100 bg, slate-400 text
 *  - Row opacity 0.55 when inactive
 *  - Chevron icon (›) at end of row
 *  - Custom Toggle: 44×26, brand-600=on / slate-200=off, white thumb 22×22, top:2, Animated
 *  - Hint text below header (exact string from source)
 *  - Empty state (exact strings from source)
 *  - FAB "Hizmet Ekle" bottom-right, brand-600 bg, + icon, shadow
 *  - ServiceSheet bottom sheet:
 *      drag handle, "Yeni Hizmet" / "Hizmet Düzenle" title + İptal
 *      Hizmet Adı field, DurPicker 4-col grid, Fiyat field
 *      Active toggle row ("Müşteri ekranında görünür" / "Rezervasyona kapalı")
 *      Summary row (canSave: "name · dur dk · price₺")
 *      "Ekle" / "Kaydet" primary btn
 *      "Hizmeti Sil" → "Vazgeç" / "Evet, Sil" two-step confirm
 *  - DurPicker: 4-col, [15,20,30,45,60,90,120], height 40, borderRadius 9
 *      selected=ink-900/white, unselected=white/ink-900, value fontSize 14 Bold, "dk" 9 SemiBold opacity 0.6
 *  - Dummy data: Saç Kesimi 30/200 active, Saç+Sakal 45/300 active,
 *                Sakal Şekillendirme 20/150 active, Fön+Şekillendirme 40/250 inactive
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
import { useRouter } from 'expo-router';
import { colors, radius } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { trackEvent } from '../../lib/analytics';
import { serviceFormToDb, serviceRowToView } from '../../lib/service-mappers';

/* ─── Data ──────────────────────────────────────────────────── */

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  active: boolean;
}

const INIT_SERVICES: Service[] = [];

/* ─── Toggle ────────────────────────────────────────────────── */

interface ToggleProps {
  on: boolean;
  onChange: (val: boolean) => void;
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

/* ─── DurPicker ─────────────────────────────────────────────── */

interface DurPickerProps {
  value: number;
  onChange: (val: number) => void;
}

function DurPicker({ value, onChange }: DurPickerProps) {
  return (
    <View style={styles.durGrid}>
      {DURATIONS.map((d) => {
        const sel = value === d;
        return (
          <TouchableOpacity
            key={d}
            onPress={() => onChange(d)}
            style={[styles.durCell, sel ? styles.durCellSel : styles.durCellUnsel]}
            activeOpacity={0.75}
          >
            <Text style={[styles.durValue, sel ? styles.durValueSel : styles.durValueUnsel]}>
              {d}
            </Text>
            <Text style={[styles.durUnit, sel ? styles.durUnitSel : styles.durUnitUnsel]}>
              dk
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ─── ServiceSheet ──────────────────────────────────────────── */

interface ServiceSheetProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<Service, 'id'>) => void;
  onDelete?: () => void;
  initial: Service | null;
}

function ServiceSheet({ open, onClose, onSave, onDelete, initial }: ServiceSheetProps) {
  const isNew = !initial;
  const [name,     setName]     = useState(initial?.name     ?? '');
  const [duration, setDuration] = useState(initial?.duration ?? 30);
  const [price,    setPrice]    = useState(initial?.price != null ? String(initial.price) : '');
  const [active,   setActive]   = useState(initial?.active   ?? true);
  const [confirm,  setConfirm]  = useState(false);

  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setDuration(initial?.duration ?? 30);
      setPrice(initial?.price != null ? String(initial.price) : '');
      setActive(initial?.active ?? true);
      setConfirm(false);
    }
  }, [open]);

  const canSave = name.trim().length >= 2 && price !== '';

  function handleSave() {
    if (!canSave) return;
    onSave({ name: name.trim(), duration, price: Number(price), active });
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
          {/* Drag handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {isNew ? 'Yeni Hizmet' : 'Hizmet Düzenle'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={styles.sheetCancelBtn}>İptal</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.sheetBodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Hizmet Adı */}
            <View>
              <Text style={styles.fieldLabel}>Hizmet Adı</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="örn. Saç Kesimi"
                placeholderTextColor={colors.slate[300]}
                style={styles.textInput}
              />
            </View>

            {/* Süre */}
            <View>
              <Text style={styles.fieldLabel}>Süre</Text>
              <DurPicker value={duration} onChange={setDuration} />
            </View>

            {/* Fiyat */}
            <View>
              <Text style={styles.fieldLabel}>Fiyat (₺)</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="örn. 200"
                placeholderTextColor={colors.slate[300]}
                keyboardType="numeric"
                style={[styles.textInput, styles.textInputPrice]}
              />
            </View>

            {/* Aktif toggle row */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleRowTitle}>Aktif</Text>
                <Text style={styles.toggleRowSub}>
                  {active ? 'Müşteri ekranında görünür' : 'Rezervasyona kapalı'}
                </Text>
              </View>
              <Toggle on={active} onChange={setActive} />
            </View>

            {/* Summary row */}
            {canSave && (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Özet</Text>
                <Text style={styles.summaryValue}>
                  {name} · {duration} dk · {price}₺
                </Text>
              </View>
            )}

            {/* Primary CTA */}
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
              activeOpacity={canSave ? 0.8 : 1}
            >
              <Text style={styles.primaryBtnText}>
                {isNew ? 'Ekle' : 'Kaydet'}
              </Text>
            </TouchableOpacity>

            {/* Delete / confirm */}
            {!isNew && (
              confirm ? (
                <View style={styles.confirmRow}>
                  <TouchableOpacity
                    onPress={() => setConfirm(false)}
                    style={[styles.confirmBtn, styles.confirmBtnSecondary]}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.confirmBtnSecondaryText}>Vazgeç</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onDelete}
                    style={[styles.confirmBtn, styles.confirmBtnDanger]}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.confirmBtnDangerText}>Evet, Sil</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setConfirm(true)}
                  style={styles.deleteBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteBtnText}>Hizmeti Sil</Text>
                </TouchableOpacity>
              )
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─── ServiceRow ────────────────────────────────────────────── */

interface ServiceRowProps {
  service: Service;
  onPress: () => void;
  onToggle: () => void;
}

function ServiceRow({ service: sv, onPress, onToggle }: ServiceRowProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.row,
        pressed && styles.rowPressed,
        !sv.active && styles.rowInactive,
      ]}
    >
      {/* Color dot */}
      <View
        style={[
          styles.dot,
          { backgroundColor: sv.active ? colors.mint[600] : colors.slate[300] },
        ]}
      />

      {/* Info */}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{sv.name}</Text>
        <View style={styles.rowBadges}>
          <View style={styles.durBadge}>
            <Text style={styles.durBadgeText}>{sv.duration} dk</Text>
          </View>
          <View style={styles.priceBadge}>
            <Text style={styles.priceBadgeText}>{sv.price}₺</Text>
          </View>
          {!sv.active && (
            <View style={styles.pasifBadge}>
              <Text style={styles.pasifBadgeText}>Pasif</Text>
            </View>
          )}
        </View>
      </View>

      {/* Toggle + chevron */}
      <View style={styles.rowTrailing}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation && e.stopPropagation();
            onToggle();
          }}
          hitSlop={8}
        >
          <Toggle on={sv.active} onChange={() => onToggle()} />
        </Pressable>
        <View style={styles.chevronWrap}>
          <View style={styles.chevronLine1} />
          <View style={styles.chevronLine2} />
        </View>
      </View>
    </Pressable>
  );
}

/* ─── Main Screen ───────────────────────────────────────────── */

export default function ServicesScreen() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>(INIT_SERVICES);
  const [editing,  setEditing]  = useState<Service | null>(null);
  const [adding,   setAdding]   = useState(false);
  const [shopId,   setShopId]   = useState<string | null>(null);
  const nextId = useRef(1);

  useEffect(() => { loadServices(); }, []);

  async function loadServices() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: shopData, error: shopErr } = await supabase.from('shops').select('id').or(`owner_user_id.eq.${user.id},owner_id.eq.${user.id}`).maybeSingle();
    if (shopErr) {
      Alert.alert('Hata', `Dükkan yüklenemedi: ${shopErr.message}`);
      return;
    }
    if (!shopData) { setShopId(null); return; }
    setShopId(shopData.id);
    const { data, error: servicesErr } = await supabase.from('services').select('id, name, duration_min, price_cents, is_active').eq('shop_id', shopData.id).order('name');
    if (servicesErr) {
      Alert.alert('Hata', `Hizmetler yüklenemedi: ${servicesErr.message}`);
      return;
    }
    if (data) setServices(data.map((s: any) => serviceRowToView(s)));
  }

  async function saveEdit(data: Omit<Service, 'id'>) {
    if (!editing) return;
    const { error } = await supabase.from('services').update(serviceFormToDb(data)).eq('id', editing.id);
    if (error) {
      Alert.alert('Hata', `Hizmet kaydedilemedi: ${error.message}`);
      return;
    }
    trackEvent('service_edited');
    setServices((s) => s.map((sv) => sv.id === editing.id ? { ...sv, ...data } : sv));
    setEditing(null);
  }

  async function deleteEdit() {
    if (!editing) return;
    const { error } = await supabase.from('services').delete().eq('id', editing.id);
    if (error) {
      Alert.alert('Hata', `Hizmet silinemedi: ${error.message}`);
      return;
    }
    setServices((s) => s.filter((sv) => sv.id !== editing.id));
    setEditing(null);
  }

  async function saveAdd(data: Omit<Service, 'id'>) {
    if (!shopId) {
      Alert.alert('Hata', 'Dükkan bilgisi yüklenemedi. Lütfen tekrar deneyin.');
      return;
    }
    const { data: inserted, error } = await supabase.from('services').insert({
      shop_id: shopId,
      ...serviceFormToDb(data),
    }).select('id, name, duration_min, price_cents, is_active').single();
    if (error || !inserted) {
      Alert.alert('Hata', `Hizmet eklenemedi: ${error?.message ?? 'bilinmeyen hata'}`);
      return;
    }
    if (inserted) {
      trackEvent('service_added');
      setServices((s) => [...s, serviceRowToView(inserted as any)]);
    }
    setAdding(false);
  }

  async function toggleActive(id: string) {
    const sv = services.find(s => s.id === id);
    if (!sv) return;
    const { error } = await supabase.from('services').update({ is_active: !sv.active }).eq('id', id);
    if (error) {
      Alert.alert('Hata', `Hizmet durumu değiştirilemedi: ${error.message}`);
      return;
    }
    setServices((s) => s.map((sv) => sv.id === id ? { ...sv, active: !sv.active } : sv));
  }

  return (
    <View style={styles.screen}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10} activeOpacity={0.7}>
          <View style={styles.backChevron1} />
          <View style={styles.backChevron2} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Dükkan Ayarları</Text>
          <Text style={styles.pageTitle}>Hizmetler</Text>
        </View>
        <TouchableOpacity
          onPress={() => setAdding(true)}
          style={styles.headerAddBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.headerAddBtnPlus}>+</Text>
          <Text style={styles.headerAddBtnText}>Ekle</Text>
        </TouchableOpacity>
      </View>

      {/* Hint */}
      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>
          Aktif hizmetler müşteri rezervasyon ekranında görünür. Pasif hizmetler sisteme kayıtlı kalır.
        </Text>
      </View>

      {/* Service list or empty state */}
      {services.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Henüz hizmet yok</Text>
          <Text style={styles.emptyBody}>
            Randevu alınabilmesi için en az bir hizmet ekleyin.
          </Text>
          <TouchableOpacity
            onPress={() => setAdding(true)}
            style={styles.emptyCtaBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyCtaBtnText}>Hizmet Ekle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {services.map((sv) => (
            <ServiceRow
              key={sv.id}
              service={sv}
              onPress={() => setEditing(sv)}
              onToggle={() => toggleActive(sv.id)}
            />
          ))}
        </ScrollView>
      )}

      {/* FAB */}
      {services.length > 0 && (
        <View style={styles.fab}>
          <TouchableOpacity
            onPress={() => setAdding(true)}
            style={styles.fabBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.fabBtnPlus}>+</Text>
            <Text style={styles.fabBtnText}>Hizmet Ekle</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Edit sheet */}
      <ServiceSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
        onDelete={deleteEdit}
        initial={editing}
      />

      {/* Add sheet */}
      <ServiceSheet
        open={adding}
        onClose={() => setAdding(false)}
        onSave={saveAdd}
        initial={null}
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
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    flexShrink: 0,
  },
  backChevron1: {
    position: 'absolute',
    width: 9,
    height: 1.8,
    backgroundColor: colors.ink[900],
    borderRadius: 1,
    transform: [{ rotate: '45deg' }, { translateY: -3 }],
  },
  backChevron2: {
    position: 'absolute',
    width: 9,
    height: 1.8,
    backgroundColor: colors.ink[900],
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }, { translateY: 3 }],
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

  /* Hint */
  hintContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  hintText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    lineHeight: 18,
  },

  /* List */
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 8,
  },

  /* Service row */
  row: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.slate[0],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 0,
    elevation: 1,
  },
  rowPressed: {
    shadowColor: colors.ink[900],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  rowInactive: {
    opacity: 0.55,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    flexShrink: 0,
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 15,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
  },
  rowBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 5,
    flexWrap: 'wrap',
  },
  durBadge: {
    backgroundColor: colors.slate[100],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  durBadgeText: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.slate[500],
  },
  priceBadge: {
    backgroundColor: colors.ink[900],
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  priceBadgeText: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    color: '#ffffff',
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
    letterSpacing: 0.44,
  },
  rowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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

  /* Empty state */
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.slate[700],
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    lineHeight: 19.5,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  emptyCtaBtn: {
    height: 44,
    paddingHorizontal: 18,
    backgroundColor: colors.ink[900],
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaBtnText: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#ffffff',
  },

  /* FAB */
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    zIndex: 10,
  },
  fabBtn: {
    height: 44,
    paddingHorizontal: 18,
    backgroundColor: colors.brand[600],
    borderWidth: 1,
    borderColor: colors.brand[700],
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    shadowColor: colors.brand[600],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  fabBtnPlus: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: '#ffffff',
    lineHeight: 16,
  },
  fabBtnText: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#ffffff',
  },

  /* Toggle */
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 999,
    position: 'relative',
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

  /* DurPicker — 4-col grid */
  durGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  durCell: {
    width: '23%',
    height: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  durCellSel: {
    backgroundColor: colors.ink[900],
    borderColor: colors.ink[900],
  },
  durCellUnsel: {
    backgroundColor: colors.slate[0],
    borderColor: colors.slate[200],
  },
  durValue: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
  },
  durValueSel: {
    color: '#ffffff',
  },
  durValueUnsel: {
    color: colors.ink[900],
  },
  durUnit: {
    fontSize: 9,
    fontFamily: 'Montserrat-SemiBold',
    opacity: 0.6,
    letterSpacing: 0.54,
  },
  durUnitSel: {
    color: '#ffffff',
  },
  durUnitUnsel: {
    color: colors.ink[900],
  },

  /* Sheet */
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
  sheetBody: {
    flexShrink: 1,
  },
  sheetBodyContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 16,
  },

  /* Form fields */
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
  textInputPrice: {
    fontFamily: 'Montserrat-SemiBold',
  },

  /* Toggle row inside sheet */
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  toggleRowTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
  },
  toggleRowSub: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    marginTop: 2,
  },

  /* Summary */
  summaryBox: {
    backgroundColor: colors.slate[100],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  summaryLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.slate[500],
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
  },

  /* Primary CTA */
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

  /* Delete / confirm */
  deleteBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.coral[600],
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  confirmBtnSecondary: {
    backgroundColor: 'transparent',
    borderColor: colors.ink[900],
  },
  confirmBtnSecondaryText: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
  },
  confirmBtnDanger: {
    backgroundColor: 'transparent',
    borderColor: colors.coral[600],
  },
  confirmBtnDangerText: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.coral[600],
  },
});
