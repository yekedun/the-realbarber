/**
 * M29 · Onboarding Sihirbazı
 * Pixel-perfect conversion from screen-29-onboarding.html
 *
 * Includes:
 *  - Step 0 Welcome: brand mark (56×56 circle, brand-600 bg, "S"),
 *      eyebrow "Berber · Dükkan Paneli", H1 "Sıradaki'ye\nHoş Geldin",
 *      subtitle, 3 step preview rows (badge colors: brand-600, mint-700, umber-600),
 *      "Kuruluma Başla" button, "Hesabın var mı? Giriş yap" footer
 *  - ProgressDots: current=20px wide, others=6px, brand-600≤current, slate-200>current,
 *      height 4, borderRadius 2, gap 6
 *  - Step 1 "Dükkanını tanıt": "Adım 1 / 3" counter,
 *      h2 "Dükkanını\ntanıt", subtitle,
 *      shop name field (border turns brand-600 when ≥2 chars), city field,
 *      live slug preview box (brand-100 bg, brand-600 border) showing "siradaki.app/slug"
 *  - Step 2 "İlk hizmetini ekle": "Adım 2 / 3",
 *      h2 "İlk hizmetini\nekle", subtitle,
 *      name field + DurPicker 3-col ([15,20,30,45,60,90]) + price field, "Geç" skip
 *  - Step 3 "Ekibini tanıt": "Adım 3 / 3",
 *      h2 "Ekibini\ntanıt", subtitle,
 *      Usta Adı field + hint + avatar preview card + info box, "Kurulumu Tamamla", "Geç"
 *  - Step 4 Done: mint-600 circle (72×72, mint-100 bg, mint-600 border 2px) with "✓",
 *      eyebrow "Kurulum Tamamlandı" mint-700, h2 "Hazırsın!", subtitle,
 *      3 summary rows, "Panele Git" button, "Rezervasyon linkini paylaş →" ghost
 */

import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../../lib/theme';

/* ─── Constants ──────────────────────────────────────────────── */

const DURATIONS_STEP2 = [15, 20, 30, 45, 60, 90];

/* ─── Progress Dots ──────────────────────────────────────────── */

interface DotsProps {
  total: number;
  current: number;
}

function Dots({ total, current }: DotsProps) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

/* ─── Onboarding Shell ───────────────────────────────────────── */

interface ShellProps {
  step: number;
  children: React.ReactNode;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  onSkip?: () => void;
}

function OnboardingShell({
  step,
  children,
  onNext,
  nextLabel = 'Devam Et',
  nextDisabled = false,
  onSkip,
}: ShellProps) {
  const TOTAL = 3;
  return (
    <View style={styles.shell}>
      {/* Top bar */}
      <View style={styles.shellTopBar}>
        <Dots total={TOTAL} current={step} />
        {onSkip && (
          <TouchableOpacity onPress={onSkip} hitSlop={8}>
            <Text style={styles.skipText}>Geç</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.shellContent}
        contentContainerStyle={styles.shellContentInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      {/* CTA */}
      <TouchableOpacity
        onPress={nextDisabled ? undefined : onNext}
        style={[styles.primaryBtn, nextDisabled && styles.primaryBtnDisabled]}
        activeOpacity={nextDisabled ? 1 : 0.8}
      >
        <Text style={styles.primaryBtnText}>{nextLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Step 0: Welcome ────────────────────────────────────────── */

interface StepWelcomeProps {
  onStart: () => void;
  onLogin: () => void;
}

function StepWelcome({ onStart, onLogin }: StepWelcomeProps) {
  const steps: { n: string; label: string; color: string }[] = [
    { n: '1', label: 'Dükkan adını gir',   color: colors.brand[600] },
    { n: '2', label: 'İlk hizmetini ekle', color: colors.mint[700]   },
    { n: '3', label: 'Ekibini tanıt',      color: colors.umber[600] },
  ];

  return (
    <View style={styles.welcomeScreen}>
      {/* Brand mark */}
      <View style={styles.welcomeMark}>
        <Text style={styles.welcomeMarkText}>S</Text>
      </View>

      {/* Eyebrow */}
      <Text style={styles.welcomeEyebrow}>Berber · Dükkan Paneli</Text>

      {/* H1 */}
      <Text style={styles.welcomeH1}>{'Sıradaki\'ye\nHoş Geldin'}</Text>

      {/* Subtitle */}
      <Text style={styles.welcomeSubtitle}>
        3 adımda dükkanını kur. Online randevu almaya hemen başla.
      </Text>

      {/* Step preview rows */}
      <View style={styles.welcomeStepsContainer}>
        {steps.map(({ n, label, color }) => (
          <View key={n} style={styles.welcomeStepRow}>
            <View style={[styles.welcomeStepBadge, { backgroundColor: color }]}>
              <Text style={styles.welcomeStepBadgeText}>{n}</Text>
            </View>
            <Text style={styles.welcomeStepLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <TouchableOpacity
        onPress={onStart}
        style={[styles.primaryBtn, styles.primaryBtnFull]}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryBtnText}>Kuruluma Başla</Text>
      </TouchableOpacity>

      {/* Login footer */}
      <TouchableOpacity onPress={onLogin} style={styles.loginFooter}>
        <Text style={styles.loginFooterText}>
          Hesabın var mı?{' '}
          <Text style={styles.loginFooterLink}>Giriş yap</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Step 1: Dükkan adı ─────────────────────────────────────── */

interface Step1Props {
  onNext: () => void;
  shopName: string;
  setShopName: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
}

function Step1({ onNext, shopName, setShopName, city, setCity }: Step1Props) {
  const slug = shopName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  return (
    <OnboardingShell
      step={0}
      onNext={onNext}
      nextDisabled={shopName.trim().length < 2}
    >
      <Text style={styles.stepEyebrow}>Adım 1 / 3</Text>
      <Text style={styles.stepH2}>{'Dükkanını\ntanıt'}</Text>
      <Text style={styles.stepSubtitle}>
        Bu bilgiler müşteri rezervasyon sayfanda görünecek.
      </Text>

      <View style={styles.fieldsCol}>
        {/* Dükkan Adı */}
        <View>
          <Text style={styles.fieldLabel}>Dükkan Adı *</Text>
          <TextInput
            value={shopName}
            onChangeText={setShopName}
            placeholder="örn. Keskin Berber"
            placeholderTextColor={colors.slate[300]}
            style={[
              styles.textInput,
              shopName.trim().length >= 2 && styles.textInputValid,
            ]}
          />
        </View>

        {/* Şehir / İlçe */}
        <View>
          <Text style={styles.fieldLabel}>Şehir / İlçe</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="örn. Beşiktaş, İstanbul"
            placeholderTextColor={colors.slate[300]}
            style={styles.textInput}
          />
        </View>

        {/* Slug preview */}
        {shopName.trim().length >= 2 && (
          <View style={styles.slugBox}>
            <Text style={styles.slugLabel}>Rezervasyon linkin</Text>
            <Text style={styles.slugValue}>siradaki.app/{slug}</Text>
          </View>
        )}
      </View>
    </OnboardingShell>
  );
}

/* ─── DurPicker 3-col (Step 2) ───────────────────────────────── */

interface DurPicker3Props {
  value: number;
  onChange: (v: number) => void;
}

function DurPicker3({ value, onChange }: DurPicker3Props) {
  return (
    <View style={styles.durGrid3}>
      {DURATIONS_STEP2.map((d) => {
        const sel = value === d;
        return (
          <TouchableOpacity
            key={d}
            onPress={() => onChange(d)}
            style={[styles.durCell3, sel ? styles.durCellSel : styles.durCellUnsel]}
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

/* ─── Step 2: İlk hizmet ─────────────────────────────────────── */

interface Step2Props {
  onNext: () => void;
  onSkip: () => void;
  svcName: string;
  setSvcName: (v: string) => void;
  svcDur: number;
  setSvcDur: (v: number) => void;
  svcPrice: string;
  setSvcPrice: (v: string) => void;
}

function Step2({
  onNext, onSkip,
  svcName, setSvcName,
  svcDur, setSvcDur,
  svcPrice, setSvcPrice,
}: Step2Props) {
  const canNext = svcName.trim().length >= 2 && svcPrice !== '';

  return (
    <OnboardingShell
      step={1}
      onNext={onNext}
      nextDisabled={!canNext}
      onSkip={onSkip}
    >
      <Text style={styles.stepEyebrow}>Adım 2 / 3</Text>
      <Text style={styles.stepH2}>{'İlk hizmetini\nekle'}</Text>
      <Text style={styles.stepSubtitle}>
        Daha fazlasını sonra ekleyebilirsin.
      </Text>

      <View style={styles.fieldsCol}>
        {/* Hizmet Adı */}
        <View>
          <Text style={styles.fieldLabel}>Hizmet Adı</Text>
          <TextInput
            value={svcName}
            onChangeText={setSvcName}
            placeholder="örn. Saç Kesimi"
            placeholderTextColor={colors.slate[300]}
            style={styles.textInput}
          />
        </View>

        {/* Süre */}
        <View>
          <Text style={styles.fieldLabel}>Süre</Text>
          <DurPicker3 value={svcDur} onChange={setSvcDur} />
        </View>

        {/* Fiyat */}
        <View>
          <Text style={styles.fieldLabel}>Fiyat (₺)</Text>
          <TextInput
            value={svcPrice}
            onChangeText={setSvcPrice}
            placeholder="örn. 200"
            placeholderTextColor={colors.slate[300]}
            keyboardType="numeric"
            style={[styles.textInput, styles.textInputPrice]}
          />
        </View>
      </View>
    </OnboardingShell>
  );
}

/* ─── Step 3: Personel ───────────────────────────────────────── */

interface Step3Props {
  onNext: () => void;
  onSkip: () => void;
  staffName: string;
  setStaffName: (v: string) => void;
}

function Step3({ onNext, onSkip, staffName, setStaffName }: Step3Props) {
  const initials = staffName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <OnboardingShell
      step={2}
      onNext={onNext}
      nextLabel="Kurulumu Tamamla"
      onSkip={onSkip}
    >
      <Text style={styles.stepEyebrow}>Adım 3 / 3</Text>
      <Text style={styles.stepH2}>{'Ekibini\ntanıt'}</Text>
      <Text style={styles.stepSubtitle}>
        Opsiyonel — sonradan Ekip ekranından ekleyebilirsin.
      </Text>

      <View style={styles.fieldsCol}>
        {/* Usta Adı */}
        <View>
          <Text style={styles.fieldLabel}>Usta Adı</Text>
          <TextInput
            value={staffName}
            onChangeText={setStaffName}
            placeholder="Ad Soyad"
            placeholderTextColor={colors.slate[300]}
            style={styles.textInput}
          />
          <Text style={styles.staffHint}>
            Dükkan sahibiyseniz kendinizi de ekleyin.
          </Text>
        </View>

        {/* Avatar preview */}
        {staffName.trim().length >= 2 && (
          <View style={styles.staffPreviewCard}>
            <View style={styles.staffAvatar}>
              <Text style={styles.staffAvatarText}>{initials}</Text>
            </View>
            <View>
              <Text style={styles.staffPreviewName}>{staffName}</Text>
              <Text style={styles.staffPreviewSub}>
                Randevu linki otomatik oluşturulacak
              </Text>
            </View>
          </View>
        )}

        {/* Info box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoBoxText}>
            Birden fazla ustanız varsa kurulum sonrasında Ekip ekranından hepsini ekleyebilirsiniz.
          </Text>
        </View>
      </View>
    </OnboardingShell>
  );
}

/* ─── Step 4: Done ───────────────────────────────────────────── */

interface StepDoneProps {
  shopName: string;
  cityName: string;
  svcName: string;
  svcDur: number;
  svcPrice: string;
  onGo: () => void;
  onShare: () => void;
}

function StepDone({ shopName, cityName, svcName, svcDur, svcPrice, onGo, onShare }: StepDoneProps) {
  const slug = shopName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const summaryRows = [
    { label: 'Dükkan',      value: `${shopName || 'Keskin Berber'} · ${cityName || 'Beşiktaş'}` },
    { label: 'İlk Hizmet',  value: `${svcName  || 'Saç Kesimi'} · ${svcDur} dk · ${svcPrice || '200'}₺` },
    { label: 'Rezervasyon', value: `siradaki.app/${slug || 'dukkanim'}` },
  ];

  return (
    <ScrollView
      style={styles.doneScreen}
      contentContainerStyle={styles.doneScreenInner}
      showsVerticalScrollIndicator={false}
    >
      {/* Check circle */}
      <View style={styles.doneCheckCircle}>
        <Text style={styles.doneCheckmark}>✓</Text>
      </View>

      {/* Eyebrow */}
      <Text style={styles.doneEyebrow}>Kurulum Tamamlandı</Text>

      {/* H2 */}
      <Text style={styles.doneH2}>Hazırsın!</Text>

      {/* Subtitle */}
      <Text style={styles.doneSubtitle}>
        Rezervasyon linkin aktif. Müşterilerin online randevu almaya başlayabilir.
      </Text>

      {/* Summary rows */}
      <View style={styles.doneSummaryCol}>
        {summaryRows.map(({ label, value }) => (
          <View key={label} style={styles.doneSummaryRow}>
            <Text style={styles.doneSummaryLabel}>{label}</Text>
            <Text style={styles.doneSummaryValue}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Panele Git */}
      <TouchableOpacity
        onPress={onGo}
        style={[styles.primaryBtn, styles.primaryBtnFull]}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryBtnText}>Panele Git</Text>
      </TouchableOpacity>

      {/* Share ghost */}
      <TouchableOpacity onPress={onShare} style={styles.shareBtn}>
        <Text style={styles.shareBtnText}>Rezervasyon linkini paylaş →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ─── Root ───────────────────────────────────────────────────── */

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);

  // Step 1 state
  const [shopName,  setShopName]  = useState('');
  const [city,      setCity]      = useState('');

  // Step 2 state
  const [svcName,   setSvcName]   = useState('');
  const [svcDur,    setSvcDur]    = useState(30);
  const [svcPrice,  setSvcPrice]  = useState('');

  // Step 3 state
  const [staffName, setStaffName] = useState('');

  function handleLogin() {
    // TODO: connect Supabase — navigate to login screen
  }
  function handleGo() {
    // TODO: connect Supabase — mark onboarding complete, navigate to owner dashboard
  }
  function handleShare() {
    // TODO: connect Supabase — share reservation link via native share sheet
  }
  function handleNext3() {
    // TODO: connect Supabase — save staff entry for new shop
    setStep(4);
  }

  if (step === 0) {
    return <StepWelcome onStart={() => setStep(1)} onLogin={handleLogin} />;
  }
  if (step === 1) {
    return (
      <Step1
        onNext={() => setStep(2)}
        shopName={shopName}
        setShopName={setShopName}
        city={city}
        setCity={setCity}
      />
    );
  }
  if (step === 2) {
    return (
      <Step2
        onNext={() => setStep(3)}
        onSkip={() => setStep(3)}
        svcName={svcName}
        setSvcName={setSvcName}
        svcDur={svcDur}
        setSvcDur={setSvcDur}
        svcPrice={svcPrice}
        setSvcPrice={setSvcPrice}
      />
    );
  }
  if (step === 3) {
    return (
      <Step3
        onNext={handleNext3}
        onSkip={() => setStep(4)}
        staffName={staffName}
        setStaffName={setStaffName}
      />
    );
  }
  // step === 4
  return (
    <StepDone
      shopName={shopName}
      cityName={city}
      svcName={svcName}
      svcDur={svcDur}
      svcPrice={svcPrice}
      onGo={handleGo}
      onShare={handleShare}
    />
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  /* Progress dots */
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.brand[600],
  },
  dotInactive: {
    width: 6,
    backgroundColor: colors.slate[200],
  },

  /* Shell */
  shell: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
  },
  shellTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  skipText: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.slate[400],
  },
  shellContent: {
    flex: 1,
  },
  shellContentInner: {
    paddingBottom: 24,
  },

  /* Primary button (shared) */
  primaryBtn: {
    height: 52,
    backgroundColor: colors.ink[900],
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnFull: {
    alignSelf: 'stretch',
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: 'Montserrat-SemiBold',
    color: '#ffffff',
  },

  /* Step typography */
  stepEyebrow: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.slate[400],
    marginBottom: 12,
  },
  stepH2: {
    fontSize: 26,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: -0.52,
    lineHeight: 28.6,
    color: colors.ink[900],
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    lineHeight: 21,
    marginBottom: 28,
  },

  /* Fields column */
  fieldsCol: {
    gap: 14,
  },
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
  textInputValid: {
    borderColor: colors.brand[600],
  },
  textInputPrice: {
    fontFamily: 'Montserrat-SemiBold',
  },

  /* Slug preview box */
  slugBox: {
    backgroundColor: colors.brand[100],
    borderWidth: 1,
    borderColor: colors.brand[600],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  slugLabel: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.brand[700],
    marginBottom: 4,
  },
  slugValue: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.brand[600],
  },

  /* DurPicker 3-col */
  durGrid3: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  durCell3: {
    width: '30%',
    height: 44,
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

  /* Staff step */
  staffHint: {
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[400],
    marginTop: 5,
  },
  staffPreviewCard: {
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  staffAvatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: colors.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffAvatarText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: '#ffffff',
  },
  staffPreviewName: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
  },
  staffPreviewSub: {
    fontSize: 11,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    marginTop: 2,
  },
  infoBox: {
    backgroundColor: colors.slate[100],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  infoBoxText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
    lineHeight: 18,
  },

  /* Welcome screen */
  welcomeScreen: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  welcomeMark: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: colors.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  welcomeMarkText: {
    fontSize: 24,
    fontFamily: 'Montserrat-Bold',
    color: '#ffffff',
  },
  welcomeEyebrow: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.slate[400],
    marginBottom: 14,
    textAlign: 'center',
  },
  welcomeH1: {
    fontSize: 30,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: -0.66,
    lineHeight: 33,
    color: colors.ink[900],
    textAlign: 'center',
    marginBottom: 14,
  },
  welcomeSubtitle: {
    fontSize: 15,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[700],
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 48,
    maxWidth: 260,
  },
  welcomeStepsContainer: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  welcomeStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  welcomeStepBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  welcomeStepBadgeText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: '#ffffff',
  },
  welcomeStepLabel: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
  },
  loginFooter: {
    marginTop: 14,
    alignItems: 'center',
  },
  loginFooterText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[500],
  },
  loginFooterLink: {
    fontFamily: 'Montserrat-SemiBold',
    color: colors.brand[600],
  },

  /* Done screen */
  doneScreen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  doneScreenInner: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 32,
  },
  doneCheckCircle: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: colors.mint[100],
    borderWidth: 2,
    borderColor: colors.mint[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  doneCheckmark: {
    fontSize: 28,
    fontFamily: 'Montserrat-Bold',
    color: colors.mint[600],
  },
  doneEyebrow: {
    fontSize: 10,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.mint[700],
    marginBottom: 12,
    textAlign: 'center',
  },
  doneH2: {
    fontSize: 26,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: -0.52,
    color: colors.ink[900],
    marginBottom: 12,
    textAlign: 'center',
  },
  doneSubtitle: {
    fontSize: 14,
    fontFamily: 'Montserrat-Regular',
    color: colors.slate[700],
    lineHeight: 22.4,
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 260,
  },
  doneSummaryCol: {
    width: '100%',
    gap: 8,
    marginBottom: 32,
  },
  doneSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 10,
  },
  doneSummaryLabel: {
    fontSize: 11,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.slate[400],
  },
  doneSummaryValue: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.ink[900],
    textAlign: 'right',
    maxWidth: 160,
  },
  shareBtn: {
    marginTop: 14,
    alignItems: 'center',
  },
  shareBtnText: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.slate[400],
  },
});
