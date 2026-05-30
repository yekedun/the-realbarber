import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

interface ContactItem {
  key: string;
  name: string;
  phone: string;
}

type ListEntry =
  | { type: 'header'; title: string; key: string }
  | { type: 'item'; item: ContactItem };

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called with the selected contact's name and phone number. */
  onSelect: (name: string, phone: string) => void;
  /** Shop ID used to query recent customers. If omitted, that section is skipped. */
  shopId?: string | null;
}

export function ContactPickerSheet({ visible, onClose, onSelect, shopId }: Props) {
  const [query, setQuery] = useState('');
  const [recentCustomers, setRecentCustomers] = useState<ContactItem[]>([]);
  const [deviceContacts, setDeviceContacts] = useState<ContactItem[]>([]);
  const [contactsStatus, setContactsStatus] = useState<
    'idle' | 'loading' | 'denied' | 'loaded'
  >('idle');

  useEffect(() => {
    if (!visible) {
      setQuery('');
      return;
    }
    loadRecentCustomers();
    // Only load contacts once — permission + heavy getContactsAsync call.
    if (contactsStatus === 'idle') {
      loadDeviceContacts();
    }
  }, [visible]);

  async function loadRecentCustomers() {
    if (!shopId) return;
    try {
      // Two-step: get all staff IDs in this shop, then query appointments.
      const { data: staffRows } = await supabase
        .from('staff')
        .select('id')
        .eq('shop_id', shopId)
        .eq('is_active', true);

      if (!staffRows?.length) return;
      const staffIds = staffRows.map((s) => s.id);

      const { data } = await supabase
        .from('appointments')
        .select('customer_name, customer_phone')
        .in('staff_id', staffIds)
        .not('customer_phone', 'is', null)
        .neq('customer_phone', '')
        .order('starts_at', { ascending: false })
        .limit(150);

      if (!data) return;

      // Deduplicate by normalised phone, keep most-recent name.
      const seen = new Set<string>();
      const items: ContactItem[] = [];
      for (const row of data) {
        const phone = row.customer_phone?.trim() ?? '';
        const norm = phone.replace(/\D/g, '');
        if (!phone || !norm || seen.has(norm)) continue;
        seen.add(norm);
        items.push({ key: `recent-${norm}`, name: row.customer_name ?? '', phone });
        if (items.length >= 20) break;
      }
      setRecentCustomers(items);
    } catch {
      // Non-fatal — section just stays empty.
    }
  }

  async function loadDeviceContacts() {
    setContactsStatus('loading');
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      setContactsStatus('denied');
      return;
    }
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      sort: Contacts.SortTypes.FirstName,
    });

    const items: ContactItem[] = [];
    for (const contact of data) {
      if (!contact.phoneNumbers?.length) continue;
      const name =
        contact.name ??
        [contact.firstName, contact.lastName].filter(Boolean).join(' ');
      if (!name.trim()) continue;

      // Prefer a mobile number; fall back to first available.
      const best =
        contact.phoneNumbers.find((p) =>
          ['mobile', 'iPhone', 'cell'].includes(p.label ?? ''),
        ) ?? contact.phoneNumbers[0];
      const phone = best?.number?.replace(/\s+/g, '') ?? '';
      if (!phone) continue;

      items.push({ key: `contact-${contact.id}-${phone}`, name: name.trim(), phone });
    }
    setDeviceContacts(items);
    setContactsStatus('loaded');
  }

  const q = query.toLowerCase().trim();

  const entries = useMemo<ListEntry[]>(() => {
    function matches(item: ContactItem): boolean {
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')) || item.phone.includes(q);
    }
    const filteredRecent = recentCustomers.filter(matches);
    const filteredContacts = deviceContacts.filter(matches);

    const result: ListEntry[] = [];
    if (filteredRecent.length > 0) {
      result.push({ type: 'header', title: 'Son Müşteriler', key: 'h-recent' });
      for (const item of filteredRecent) result.push({ type: 'item', item });
    }
    if (filteredContacts.length > 0) {
      result.push({ type: 'header', title: 'Rehber', key: 'h-contacts' });
      for (const item of filteredContacts) result.push({ type: 'item', item });
    }
    return result;
  }, [q, recentCustomers, deviceContacts]);

  const showSpinner =
    contactsStatus === 'loading' && recentCustomers.length === 0;
  const isEmpty = !showSpinner && entries.length === 0;

  function handleSelect(item: ContactItem) {
    onSelect(item.name, item.phone);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Kişi Seç</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelBtn}>İptal</Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="İsim veya numara ara…"
            placeholderTextColor={colors.slate[400]}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Content */}
        {showSpinner ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.brand[600]} />
            <Text style={styles.centerText}>Kişiler yükleniyor…</Text>
          </View>
        ) : isEmpty ? (
          <View style={styles.center}>
            <Text style={styles.centerText}>
              {q ? 'Sonuç bulunamadı.' : 'Kayıtlı müşteri veya kişi yok.'}
            </Text>
            {contactsStatus === 'denied' && (
              <Text style={styles.deniedText}>
                Rehbere erişim izni verilmedi. Telefon Ayarları'ndan izin verebilirsiniz.
              </Text>
            )}
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(e) => (e.type === 'header' ? e.key : e.item.key)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item: entry }) => {
              if (entry.type === 'header') {
                return <Text style={styles.sectionHeader}>{entry.title}</Text>;
              }
              const { item } = entry;
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarLetter}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.rowPhone}>{item.phone}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
  },
  title: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 17,
    color: colors.ink[900],
  },
  cancelBtn: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 15,
    color: colors.brand[600],
  },

  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
  },
  searchInput: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 15,
    color: colors.ink[900],
    backgroundColor: colors.slate[100],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  centerText: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 15,
    color: colors.slate[500],
    textAlign: 'center',
  },
  deniedText: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    color: colors.slate[400],
    textAlign: 'center',
    lineHeight: 20,
  },

  listContent: {
    paddingBottom: 32,
  },
  sectionHeader: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 11 * 0.16,
    textTransform: 'uppercase',
    color: colors.slate[500],
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.slate[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 16,
    color: colors.ink[900],
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 15,
    color: colors.ink[900],
  },
  rowPhone: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    color: colors.slate[500],
  },
});
