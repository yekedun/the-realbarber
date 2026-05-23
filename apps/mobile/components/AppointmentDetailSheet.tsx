/**
 * AppointmentDetailSheet
 * Source: screens.jsx → AppointmentDetailSheet + Sheet (components.jsx)
 *
 * Structure (exact from source):
 *   Sheet open={open} onClose={onClose} title="Randevu Detayı"
 *   ├─ Header row:
 *   │   overline  "10:30 · 45DK"     (11px SemiBold 0.18em uppercase slate-500)
 *   │   name      "Ahmet Yılmaz"     (22px Bold marginTop 8 ink-900)
 *   │   service   "Saç + Sakal · 45 dk · 280₺" (14px Regular fg-3 marginTop 4)
 *   ├─ Action buttons row (gap 8, marginTop 20):
 *   │   Button variant="secondary" full "Ara"
 *   │   Button variant="secondary" full "Mesaj"
 *   │   Button variant="secondary" full "Düzenle"
 *   └─ Footer buttons row (gap 10, marginTop 24):
 *       Button variant="danger"  full size="lg" "İptal Et"
 *       Button variant="accent"  full size="lg" "Tamamlandı"
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Sheet } from './ds/Sheet';
import { colors } from '../lib/theme';

// TODO: connect Supabase — fetch appointment detail by id
// supabase.from('appointments').select('*, services(name, price, duration_min), customers(name, phone)').eq('id', id).single()

export interface AppointmentDetail {
  id: string;
  time: string;
  duration: number;
  customerName: string;
  customerPhone: string | null;
  serviceName: string;
}

interface AppointmentDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  appointment: AppointmentDetail | null;
  onEdit: (id: string) => void;
  onCancel: (id: string) => void;
  onComplete: (id: string) => void;
}

export function AppointmentDetailSheet({
  visible,
  onClose,
  appointment,
  onEdit,
  onCancel,
  onComplete,
}: AppointmentDetailSheetProps) {
  if (!appointment) return null;

  const appt = appointment;
  const hasPhone = !!appt.customerPhone;

  function handleCall() {
    if (!hasPhone) return;
    Linking.openURL(`tel:${appt.customerPhone}`);
  }

  function handleSMS() {
    if (!hasPhone) return;
    Linking.openURL(`sms:${appt.customerPhone}`);
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Randevu Detayı"
      footer={
        /* Footer buttons: display flex row, gap 10, marginTop 24
           Button variant="danger" full size="lg" "İptal Et"
           Button variant="accent" full size="lg" "Tamamlandı" */
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[styles.footerBtn, styles.dangerBtn]}
            onPress={() => {
              // TODO: connect Supabase — cancel appointment RPC
              onCancel(appointment.id);
              onClose();
            }}
          >
            <Text style={styles.dangerBtnText}>İptal Et</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.footerBtn, styles.accentBtn]}
            onPress={() => {
              // TODO: connect Supabase — mark appointment completed RPC
              onComplete(appointment.id);
              onClose();
            }}
          >
            <Text style={styles.accentBtnText}>Tamamlandı</Text>
          </TouchableOpacity>
        </View>
      }
    >
      {/* Time + duration overline: "10:30 · 45DK"
          11px SemiBold 0.18em uppercase slate-500 */}
      <Text style={styles.timeHeader}>
        {appointment.time} · {appointment.duration}DK
      </Text>

      {/* Customer name: 22px Bold marginTop 8 ink-900 */}
      <Text style={styles.customerName}>{appointment.customerName}</Text>

      {/* Service: 14px Regular fg-3 marginTop 4 */}
      <Text style={styles.serviceName}>{appointment.serviceName}</Text>

      {/* Action buttons row: flex row, gap 8, marginTop 20
          Button variant="secondary" full: transparent bg, border ink-900, color ink-900
          size md: height 44 */}
      <View style={styles.actionsRow}>
        {[
          { label: 'Ara',     onPress: handleCall,  disabled: !hasPhone },
          { label: 'Mesaj',   onPress: handleSMS,   disabled: !hasPhone },
          {
            label: 'Düzenle',
            onPress: () => { onClose(); onEdit(appointment.id); },
            disabled: false,
          },
        ].map(a => (
          <TouchableOpacity
            key={a.label}
            onPress={a.onPress}
            disabled={a.disabled}
            activeOpacity={0.8}
            style={[styles.actionBtn, a.disabled && styles.actionDisabled]}
          >
            <Text style={[styles.actionLabel, a.disabled && styles.actionLabelDisabled]}>
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  /* Time overline: "10:30 · 45DK"
     fontSize 11, fontWeight 600, letterSpacing 0.18em, uppercase, color slate-500 */
  timeHeader: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 11 * 0.18,   // 0.18em
    textTransform: 'uppercase',
    color: colors.slate[500],
  },

  /* Customer name: h3 22px Bold marginTop 8 ink-900 */
  customerName: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 22,
    color: colors.ink[900],
    marginTop: 8,
  },

  /* Service: 14px Regular fg-3 marginTop 4 */
  serviceName: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 14,
    color: colors.slate[500],
    marginTop: 4,
  },

  /* Actions row: flex row, gap 8, marginTop 20 */
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  /* Action button: Button variant="secondary" full
     transparent bg, border slate-200 (from source: 'var(--slate-200)'), borderRadius 12
     height 44 (size md) */
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.slate[0],
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDisabled: {
    opacity: 0.4,
  },
  actionLabel: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 14,
    color: colors.ink[900],
    letterSpacing: 14 * -0.005,
  },
  actionLabelDisabled: {
    color: colors.slate[400],
  },

  /* Footer button row: flex row, gap 10
     (marginTop 24 is from the source: 'display: flex, gap: 10, marginTop: 24')
     Note: Sheet footer provides paddingTop 18 + borderTop; the marginTop 24 maps there */
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  footerBtn: {
    flex: 1,
    height: 52,    // size lg
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  /* Button variant="danger" full size="lg":
     transparent bg, border coral-600, color coral-600 */
  dangerBtn: {
    backgroundColor: 'transparent',
    borderColor: colors.coral[600],
  },
  dangerBtnText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 15,
    color: colors.coral[600],
    letterSpacing: 15 * -0.005,
  },

  /* Button variant="accent" full size="lg":
     bg brand-600, border brand-700, color #fff */
  accentBtn: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[700],
  },
  accentBtnText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 15,
    color: '#ffffff',
    letterSpacing: 15 * -0.005,
  },
});
