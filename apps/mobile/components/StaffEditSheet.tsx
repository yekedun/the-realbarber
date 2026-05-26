import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { colors } from '../lib/theme';
import { Button } from './ds/Button';
import { supabase } from '../lib/supabase';

export interface StaffMember {
  id: string;
  name: string;
  phone?: string;
  is_active: boolean;
  role?: string;
}

interface Props {
  staff: StaffMember | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function StaffEditSheet({ staff, visible, onClose, onSaved }: Props) {
  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (staff) {
      setName(staff.name);
      setPhone(staff.phone ?? '');
      setIsActive(staff.is_active);
      setError(null);
    }
  }, [staff]);

  async function handleSave() {
    if (!staff || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('staff')
        .update({ name: name.trim(), phone: phone.trim() || null, is_active: isActive })
        .eq('id', staff.id);
      if (err) { setError(err.message); return; }
      onSaved();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  if (!staff) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Berber Düzenle</Text>
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.label}>Ad Soyad</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName}
              placeholder="Berber adı" placeholderTextColor={colors.slate[400]} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Telefon</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone}
              placeholder="05XX XXX XX XX" keyboardType="phone-pad"
              placeholderTextColor={colors.slate[400]} />
          </View>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>{isActive ? 'Aktif' : 'Pasif'}</Text>
              <Text style={styles.toggleSub}>
                {isActive ? 'Müşteriler randevu alabilir' : 'Randevu alınamaz, takvimde görünmez'}
              </Text>
            </View>
            <Switch value={isActive} onValueChange={setIsActive}
              trackColor={{ false: colors.slate[300], true: colors.brand[500] }}
              thumbColor="#fff" />
          </View>
        </ScrollView>
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.actions}>
          <Button variant="secondary" size="md" onPress={onClose}>İptal</Button>
          <Button variant="primary" size="md" disabled={loading || !name.trim()} onPress={handleSave}>
            {loading ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff',
                  borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32,
                  maxHeight: '80%', display: 'flex', flexDirection: 'column' },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.slate[300],
                  alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  title:       { fontSize: 18, fontFamily: 'Montserrat-Bold', color: colors.ink[900],
                  paddingHorizontal: 20, marginBottom: 20 },
  field:       { paddingHorizontal: 20, marginBottom: 16 },
  label:       { fontSize: 12, fontFamily: 'Montserrat-SemiBold', color: colors.slate[500],
                  textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 },
  input:       { borderWidth: 1, borderColor: colors.slate[200], borderRadius: 10, padding: 12,
                  fontSize: 15, fontFamily: 'Montserrat-Regular', color: colors.ink[900] },
  toggleRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
                  paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.slate[100],
                  marginTop: 8, gap: 12 },
  toggleLabel: { fontSize: 15, fontFamily: 'Montserrat-SemiBold', color: colors.ink[900] },
  toggleSub:   { fontSize: 12, fontFamily: 'Montserrat-Regular', color: colors.slate[500], marginTop: 2 },
  actions:     { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16,
                  borderTopWidth: 1, borderTopColor: colors.slate[100] },
  error:       { fontSize: 13, color: '#ef4444', paddingHorizontal: 20, marginBottom: 8 },
});
