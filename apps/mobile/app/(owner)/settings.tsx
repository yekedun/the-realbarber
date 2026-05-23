/**
 * M6 · Ayarlar (Settings)
 * Pixel-perfect conversion combining:
 *   - index.html AyarlarScreen (M6)
 *   - screen-30-profile-editor.html (ProfileEditorSheet)
 *   - screen-23-hours.html (HoursEditorSheet)
 *
 * Includes:
 *  - OverlineHeader: eyebrow "Dükkan Ayarları", title "Ayarlar",
 *      meta "Widget bağlantılarını yönet ve hesabından çıkış yap."
 *  - Account info card: "Dükkan Sahibi" overline, "Keskin Berber", "berber@keskin.com"
 *  - Profile card (clickable → ProfileEditorSheet):
 *      48×48 brand-600 avatar (initials "KB"), shop name, city · slug, "Düzenle" + chevron
 *  - "Operasyon" section:
 *      - Komisyon takibi row with custom Toggle
 *          on:  "Kazanç raporu açık."
 *          off: "Randevu akışı değişmez."
 *      - Dükkan Saatleri row → HoursEditorSheet
 *          subtitle: "Pzt–Cum 09:00–19:00 · Cmt 10:00–17:00 · Paz kapalı"
 *  - "Widget Bağlantıları" section:
 *      - Existing link card: "wgt_a4f9…2b1c" mono, "Son 3 May 2026", "Sil" danger button
 *      - "+ Yeni Bağlantı" secondary button
 *  - "Çıkış yap" danger button → Alert
 *      "Çıkış Yap", "Hesaptan çıkmak istediğine emin misin?", "Vazgeç" / "Çıkış yap"
 *
 * ProfileEditorSheet (from screen-30):
 *  - Sheet title "Dükkan Bilgileri" + İptal
 *  - Avatar preview card with initials, "Önizleme" badge
 *  - Fields: Dükkan Adı (hint), Adres, Telefon (hint)
 *  - Hakkında textarea (bio.length/200 karakter)
 *  - "Profil Görünür" toggle ("Müşteriler dükkanı bulabilir" / "Dükkan arama sonuçlarında gizli")
 *  - Rezervasyon Linki info box: "siradaki.app/keskin-berber"
 *  - "Kaydet" primary btn
 *  - Success state: mint circle, "Kaydedildi", success text, "Tamam"
 *
 * HoursEditorSheet (from screen-23):
 *  - "Dükkan Saatleri" overline, "Çalışma Saatleri" title,
 *    "Keskin Berber · Müşteri randevu ekranında görünür" subtitle
 *  - 7-day tab grid (Pzt–Paz) with mint dot for open days
 *  - "Açık" toggle ("Bu gün hizmet veriliyor" / "Bu gün kapalı")
 *  - When open: "Çalışma Saatleri" grid (Açılış / Kapanış), "Mola" field
 *    mola hint text, preview row ("{day} önizleme" · "HH:MM–HH:MM")
 *  - "Tüm Günleri Kaydet" primary btn
 *
 * Custom Toggle: 44×26, brand-600=on / slate-200=off, white thumb 22×22, Animated
 */

import React, { useRef, useState } from 'react';
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

/* ─── Constants ─────────────────────────────────────────────── */

// TODO: connect Supabase — fetch shop profile
const SHOP_DATA = {
  name: 'Keskin Berber',
  address: 'Beşiktaş Meydanı No 14, İstanbul',
  bio: '1987\'den bu yana Beşiktaş\'ta. Geleneksel berber sanatını modern tekniklerle buluşturuyoruz.',
  phone: '0212 345 67 89',
  slug: 'keskin-berber',
  email: 'berber@keskin.com',
};

const INIT_SCHEDULE = [
  { id: 'pzt', label: 'Pzt', open: true,  start: '09:00', end: '19:00', brk: '' },
  { id: 'sal', label: 'Sal', open: true,  start: '09:00', end: '19:00', brk: '' },
  { id: 'car', label: 'Çar', open: true,  start: '09:00', end: '19:00', brk: '13:00' },
  { id: 'per', label: 'Per', open: true,  start: '09:00', end: '19:00', brk: '' },
  { id: 'cum', label: 'Cum', open: true,  start: '09:00', end: '19:00', brk: '' },
  { id: 'cmt', label: 'Cmt', open: true,  start: '10:00', end: '17:00', brk: '' },
  { id: 'paz', label: 'Paz', open: false, start: '',      end: '',      brk: '' },
];

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

/* ─── ProfileEditorSheet ────────────────────────────────────── */

interface ProfileEditorSheetProps {
  open: boolean;
  onClose: () => void;
}

function ProfileEditorSheet({ open, onClose }: ProfileEditorSheetProps) {
  const [name,    setName]    = useState(SHOP_DATA.name);
  const [address, setAddress] = useState(SHOP_DATA.address);
  const [bio,     setBio]     = useState(SHOP_DATA.bio);
  const [phone,   setPhone]   = useState(SHOP_DATA.phone);
  const [visible, setVisible] = useState(true);
  const [saved,   setSaved]   = useState(false);

  const canSave = name.trim().length >= 2;

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function handleSave() {
    if (!canSave) return;
    // TODO: connect Supabase — update shop profile (name, address, bio, phone, visible)
    setSaved(true);
  }

  function handleClose() {
    setSaved(false);
    onClose();
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={handleClose}>
        <Pressable style={styles.sheetContainer} onPress={() => {}}>
          {/* Drag handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Dükkan Bilgileri</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={8}>
              <Text style={styles.sheetCancelBtn}>İptal</Text>
            </TouchableOpacity>
          </View>

          {saved ? (
            /* Success state */
            <View style={styles.profileSavedContainer}>
              <View style={styles.profileSavedCircle}>
                <Text style={styles.profileSavedCheck}>✓</Text>
              </View>
              <Text style={styles.profileSavedTitle}>Kaydedildi</Text>
              <Text style={styles.profileSavedBody}>
                Dükkan bilgileri güncellendi.{'\n'}Müşteri ekranına yansıması birkaç dakika sürebilir.
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.primaryBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>Tamam</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={styles.sheetBody}
              contentContainerStyle={styles.sheetBodyContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Avatar preview */}
              <View style={styles.profileAvatarCard}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileAvatarName}>{name || 'Dükkan Adı'}</Text>
                  <Text style={styles.profileAvatarCity}>
                    {address.split(',')[0]}
                  </Text>
                </View>
                <View style={styles.profilePreviewBadge}>
                  <Text style={styles.profilePreviewBadgeText}>Önizleme</Text>
                </View>
              </View>

              {/* Dükkan Adı */}
              <View>
                <Text style={styles.fieldLabel}>Dükkan Adı</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="örn. Keskin Berber"
                  placeholderTextColor={colors.slate[300]}
                  style={styles.textInput}
                />
                <Text style={styles.fieldHint}>
                  Müşteri rezervasyon ekranında görünür
                </Text>
              </View>

              {/* Adres */}
              <View>
                <Text style={styles.fieldLabel}>Adres</Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Mahalle, Sokak No, İl"
                  placeholderTextColor={colors.slate[300]}
                  style={styles.textInput}
                />
              </View>

              {/* Telefon */}
              <View>
                <Text style={styles.fieldLabel}>Telefon</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="0(2xx) xxx xx xx"
                  placeholderTextColor={colors.slate[300]}
                  keyboardType="phone-pad"
                  style={styles.textInput}
                />
                <Text style={styles.fieldHint}>
                  Opsiyonel — müşteri detay sayfasında gösterilir
                </Text>
              </View>

              {/* Hakkında */}
              <View>
                <Text style={styles.fieldLabel}>Hakkında</Text>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Dükkanınız hakkında kısa bir açıklama..."
                  placeholderTextColor={colors.slate[300]}
                  multiline
                  numberOfLines={3}
                  style={[styles.textInput, styles.textArea]}
                />
                <Text style={styles.fieldHint}>{bio.length}/200 karakter</Text>
              </View>

              {/* Profil Görünür toggle */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleRowTitle}>Profil Görünür</Text>
                  <Text style={styles.toggleRowSub}>
                    {visible
                      ? 'Müşteriler dükkanı bulabilir'
                      : 'Dükkan arama sonuçlarında gizli'}
                  </Text>
                </View>
                <Toggle on={visible} onChange={setVisible} />
              </View>

              {/* Slug info */}
              <View style={styles.slugBox}>
                <Text style={styles.slugLabel}>Rezervasyon Linki</Text>
                <Text style={styles.slugValue}>siradaki.app/{SHOP_DATA.slug}</Text>
              </View>

              {/* Kaydet */}
              <TouchableOpacity
                onPress={canSave ? handleSave : undefined}
                style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
                activeOpacity={canSave ? 0.8 : 1}
              >
                <Text style={styles.primaryBtnText}>Kaydet</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─── HoursEditorSheet ──────────────────────────────────────── */

interface ScheduleDay {
  id: string;
  label: string;
  open: boolean;
  start: string;
  end: string;
  brk: string;
}

interface HoursEditorSheetProps {
  open: boolean;
  onClose: () => void;
}

function HoursEditorSheet({ open, onClose }: HoursEditorSheetProps) {
  const [schedule, setSchedule] = useState<ScheduleDay[]>(INIT_SCHEDULE);
  const [sel, setSel] = useState(0);
  const day = schedule[sel];

  function update(field: keyof ScheduleDay, val: string | boolean) {
    setSchedule((s) => s.map((d, i) => i === sel ? { ...d, [field]: val } : d));
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
          <View style={[styles.sheetHandle, { marginBottom: 18 }]} />

          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.sheetBodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title block */}
            <View style={styles.hoursHeaderBlock}>
              <Text style={styles.hoursEyebrow}>Dükkan Saatleri</Text>
              <Text style={styles.hoursTitle}>Çalışma Saatleri</Text>
              <Text style={styles.hoursSubtitle}>
                Keskin Berber · Müşteri randevu ekranında görünür
              </Text>
            </View>

            {/* Day tabs */}
            <View style={styles.dayTabsRow}>
              {schedule.map((d, i) => {
                const isSel = sel === i;
                return (
                  <TouchableOpacity
                    key={d.id}
                    onPress={() => setSel(i)}
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
                      {d.label}
                    </Text>
                    <View
                      style={[
                        styles.dayTabDot,
                        {
                          backgroundColor: d.open
                            ? isSel
                              ? 'rgba(255,255,255,0.5)'
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
                  <Text style={styles.openToggleTitle}>Açık</Text>
                  <Text style={styles.openToggleSub}>
                    {day.open ? 'Bu gün hizmet veriliyor' : 'Bu gün kapalı'}
                  </Text>
                </View>
                <Toggle on={day.open} onChange={(v) => update('open', v)} />
              </View>
            </View>

            {day.open && (
              <>
                {/* Çalışma Saatleri */}
                <View>
                  <Text style={styles.timeSectionLabel}>Çalışma Saatleri</Text>
                  <View style={styles.timeGrid}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timeFieldLabel}>Açılış</Text>
                      <TextInput
                        value={day.start}
                        onChangeText={(v) => update('start', v)}
                        placeholder="09:00"
                        placeholderTextColor={colors.slate[300]}
                        style={styles.timeInput}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timeFieldLabel}>Kapanış</Text>
                      <TextInput
                        value={day.end}
                        onChangeText={(v) => update('end', v)}
                        placeholder="19:00"
                        placeholderTextColor={colors.slate[300]}
                        style={styles.timeInput}
                      />
                    </View>
                  </View>
                </View>

                {/* Mola */}
                <View>
                  <Text style={styles.timeSectionLabel}>Mola (Opsiyonel)</Text>
                  <TextInput
                    value={day.brk}
                    onChangeText={(v) => update('brk', v)}
                    placeholder="örn. 13:00–14:00"
                    placeholderTextColor={colors.slate[300]}
                    style={styles.timeInputFull}
                  />
                  <Text style={styles.molaHint}>
                    Mola saatinde randevu alınamaz. Müşteri ekranında kapalı görünür.
                  </Text>
                </View>
              </>
            )}

            {/* Preview row */}
            <View style={styles.previewRow}>
              <Text style={styles.previewRowLabel}>{day.label} önizleme</Text>
              <Text style={[
                styles.previewRowValue,
                !day.open && { color: colors.slate[400] },
              ]}>
                {day.open ? `${day.start}–${day.end}` : 'Kapalı'}
              </Text>
            </View>

            {/* Save */}
            <TouchableOpacity
              onPress={() => {
                // TODO: connect Supabase — save all days schedule for this shop
                onClose();
              }}
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

/* ─── Main Screen ───────────────────────────────────────────── */

interface WidgetLink {
  id: string;
  shortId: string;
  lastUsed: string;
}

export default function SettingsScreen() {
  const [commEnabled,    setCommEnabled]    = useState(true);
  const [profileOpen,    setProfileOpen]    = useState(false);
  const [hoursOpen,      setHoursOpen]      = useState(false);
  const [widgetLinks,    setWidgetLinks]    = useState<WidgetLink[]>([
    { id: 'w1', shortId: 'a4f9…2b1c', lastUsed: '3 May 2026' },
  ]);

  function handleSignOut() {
    Alert.alert(
      'Çıkış Yap',
      'Hesaptan çıkmak istediğine emin misin?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkış yap',
          style: 'destructive',
          onPress: () => {
            // TODO: connect Supabase — supabase.auth.signOut(), navigate to login
          },
        },
      ],
    );
  }

  function handleCreateLink() {
    // TODO: connect Supabase — create widget link, return new link id
    const newId = Date.now().toString();
    setWidgetLinks((prev) => [
      ...prev,
      { id: newId, shortId: 'new…link', lastUsed: '22 May 2026' },
    ]);
  }

  function handleDeleteLink(id: string) {
    Alert.alert(
      'Bağlantı Sil',
      'Bu bağlantı silinirse widget çalışmayı durduracak.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            // TODO: connect Supabase — delete widget link
            setWidgetLinks((prev) => prev.filter((l) => l.id !== id));
          },
        },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* OverlineHeader */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Dükkan Ayarları</Text>
          <Text style={styles.pageTitle}>Ayarlar</Text>
          <Text style={styles.headerMeta}>
            Widget bağlantılarını yönet ve hesabından çıkış yap.
          </Text>
        </View>

        {/* Account info card */}
        <View style={styles.accountCard}>
          <Text style={styles.accountOverline}>Dükkan Sahibi</Text>
          <Text style={styles.accountName}>Keskin Berber</Text>
          <Text style={styles.accountEmail}>{SHOP_DATA.email}</Text>
        </View>

        {/* Profile clickable card */}
        <TouchableOpacity
          onPress={() => setProfileOpen(true)}
          style={styles.profileCard}
          activeOpacity={0.8}
        >
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>KB</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.profileCardName}>Keskin Berber</Text>
            <Text style={styles.profileCardMeta}>Beşiktaş, İstanbul · keskin-berber</Text>
          </View>
          <View style={styles.profileEditBadge}>
            <Text style={styles.profileEditText}>Düzenle</Text>
            <View style={styles.chevronWrap}>
              <View style={styles.chevronLine1} />
              <View style={styles.chevronLine2} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Section: Operasyon */}
        <Text style={styles.sectionLabel}>Operasyon</Text>
        <View style={styles.operationCard}>
          {/* Komisyon takibi */}
          <View style={styles.opRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.opRowTitle}>Komisyon takibi</Text>
              <Text style={styles.opRowMeta}>
                {commEnabled ? 'Kazanç raporu açık.' : 'Randevu akışı değişmez.'}
              </Text>
            </View>
            <Toggle on={commEnabled} onChange={(v) => {
              // TODO: connect Supabase — update commission_enabled
              setCommEnabled(v);
            }} />
          </View>

          {/* Dükkan Saatleri */}
          <TouchableOpacity
            onPress={() => setHoursOpen(true)}
            style={[styles.opRow, styles.opRowBorderTop]}
            activeOpacity={0.75}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.opRowTitle}>Dükkan Saatleri</Text>
              <Text style={styles.opRowMeta}>
                Pzt–Cum 09:00–19:00 · Cmt 10:00–17:00 · Paz kapalı
              </Text>
            </View>
            <View style={styles.chevronWrap}>
              <View style={styles.chevronLine1} />
              <View style={styles.chevronLine2} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Section: Widget Bağlantıları */}
        <Text style={styles.sectionLabel}>Widget Bağlantıları</Text>
        <View style={styles.widgetSection}>
          {widgetLinks.map((l) => (
            <View key={l.id} style={styles.widgetLinkCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.widgetLinkId}>wgt_{l.shortId}</Text>
                <Text style={styles.widgetLinkMeta}>Son {l.lastUsed}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDeleteLink(l.id)}
                style={styles.deleteLinkBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteLinkBtnText}>Sil</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            onPress={handleCreateLink}
            style={styles.newLinkBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.newLinkBtnText}>+ Yeni Bağlantı</Text>
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          onPress={handleSignOut}
          style={styles.signOutBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.signOutBtnText}>Çıkış yap</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Sıradaki · Dükkan Sahibi</Text>
      </ScrollView>

      {/* Profile editor sheet */}
      <ProfileEditorSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      {/* Hours editor sheet */}
      <HoursEditorSheet
        open={hoursOpen}
        onClose={() => setHoursOpen(false)}
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
  content: {
    paddingBottom: 48,
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
  headerMeta: {
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    marginTop: 4,
    lineHeight: 19.5,
  },

  /* Account card */
  accountCard: {
    marginHorizontal: 20,
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
  },
  accountOverline: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 1.96,
    textTransform: 'uppercase',
    color: colors.slate[500],
  },
  accountName: {
    fontSize: 17,
    fontFamily: 'Montserrat-Bold',
    color: colors.ink[900],
    marginTop: 6,
  },
  accountEmail: {
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    marginTop: 2,
  },

  /* Profile card */
  profileCard: {
    marginHorizontal: 20,
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  profileAvatarText: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: '#ffffff',
  },
  profileCardName: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    color: colors.ink[900],
  },
  profileCardMeta: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    marginTop: 3,
  },
  profileEditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileEditText: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.brand[600],
  },

  /* Section label */
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.slate[500],
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },

  /* Operation card */
  operationCard: {
    marginHorizontal: 20,
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 14,
    overflow: 'hidden',
  },
  opRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  opRowBorderTop: {
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  opRowTitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
  },
  opRowMeta: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    marginTop: 2,
  },

  /* Widget section */
  widgetSection: {
    marginHorizontal: 20,
    gap: 8,
  },
  widgetLinkCard: {
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  widgetLinkId: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
  },
  widgetLinkMeta: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    marginTop: 2,
  },
  deleteLinkBtn: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.coral[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLinkBtnText: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.coral[600],
  },
  newLinkBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.ink[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  newLinkBtnText: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
  },

  /* Sign out */
  signOutBtn: {
    marginHorizontal: 20,
    marginTop: 28,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.coral[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutBtnText: {
    fontSize: 15,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.coral[600],
  },

  /* Footer */
  footer: {
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[400],
    textAlign: 'center',
    marginTop: 24,
    letterSpacing: 0.88,
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

  /* Chevron */
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
    maxHeight: '90%',
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
  sheetBody: { flexShrink: 1 },
  sheetBodyContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 16,
  },

  /* Profile editor sheet */
  profileSavedContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  profileSavedCircle: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: colors.mint[100],
    borderWidth: 1,
    borderColor: colors.mint[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSavedCheck: {
    fontSize: 22,
    fontFamily: 'Montserrat-Bold',
    color: colors.mint[600],
  },
  profileSavedTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    color: colors.ink[900],
    textAlign: 'center',
  },
  profileSavedBody: {
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    lineHeight: 21,
    textAlign: 'center',
  },
  profileAvatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  profileAvatarName: {
    fontSize: 15,
    fontFamily: 'Montserrat-Bold',
    color: colors.ink[900],
  },
  profileAvatarCity: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    marginTop: 2,
  },
  profilePreviewBadge: {
    backgroundColor: colors.brand[100],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  profilePreviewBadgeText: {
    fontSize: 11,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.brand[600],
  },

  /* Toggle row (in sheet) */
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
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
  },
  toggleRowSub: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    marginTop: 2,
  },

  /* Slug box */
  slugBox: {
    backgroundColor: colors.slate[100],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  slugLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.slate[400],
    marginBottom: 4,
  },
  slugValue: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.brand[600],
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
  fieldHint: {
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[400],
    marginTop: 5,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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

  /* Hours editor sheet */
  hoursHeaderBlock: {
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    paddingBottom: 16,
    marginBottom: 4,
  },
  hoursEyebrow: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.slate[500],
  },
  hoursTitle: {
    fontSize: 22,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: -0.44,
    color: colors.ink[900],
    marginTop: 6,
  },
  hoursSubtitle: {
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    marginTop: 4,
  },

  /* Day tabs */
  dayTabsRow: {
    flexDirection: 'row',
    gap: 4,
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
    letterSpacing: 1.0,
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
  timeSectionLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 1.96,
    textTransform: 'uppercase',
    color: colors.slate[500],
    marginBottom: 8,
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
  timeInputFull: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
    color: colors.ink[900],
    backgroundColor: colors.slate[0],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  molaHint: {
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[400],
    marginTop: 5,
    lineHeight: 15.4,
  },

  /* Preview row */
  previewRow: {
    backgroundColor: colors.slate[100],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewRowLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    color: colors.slate[500],
  },
  previewRowValue: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: colors.ink[900],
  },
});
