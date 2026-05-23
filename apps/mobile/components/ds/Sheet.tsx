import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors, radius, shadows } from '../../lib/theme';

interface SheetProps {
  /** Controls visibility — replaces the source's `open` prop. */
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Sheet — bottom sheet modal.
 *
 * Structure (source-faithful):
 *   backdrop (tap-to-close dimmed overlay)
 *   └─ sheet panel
 *       ├─ handle bar      40×4, slate-200, centred
 *       ├─ header row      title (h3, 20/Bold/-0.015em) + "İptal" button (optional)
 *       ├─ scrollable body 0 20px padding
 *       └─ footer          18px top padding + slate-100 top border + 18px margin-top (optional)
 */
export function Sheet({ visible, onClose, title, children, footer }: SheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Dimmed backdrop — tap anywhere to close */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Sheet panel */}
      <View style={styles.sheet}>
        {/* Handle bar */}
        <View style={styles.handle} />

        {/* Header: title + İptal */}
        {title != null && (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancel}>İptal</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scrollable body */}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>

        {/* Optional footer */}
        {footer != null && (
          <View style={styles.footer}>
            {footer}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /**
   * backdrop: flex: 1 fills the space above the sheet so it can receive touches.
   * The sheet itself is pushed to the bottom by the Modal's slide animation.
   */
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,20,16,0.36)',
  },

  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: radius.lg,   /* 18 */
    borderTopRightRadius: radius.lg,  /* 18 */
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '78%',
    ...shadows.lg,
  },

  /* Handle bar: 40×4, centred, slate-200 */
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.slate[200],
    borderRadius: 4,
    alignSelf: 'center',
    marginBottom: 14,
  },

  /* Header row */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Montserrat-Bold',
    letterSpacing: -0.3,
    color: colors.ink[900],
  },
  cancel: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: colors.slate[500],
  },

  /* Body */
  body: {},
  bodyContent: {
    paddingHorizontal: 20,
  },

  /* Footer */
  footer: {
    paddingHorizontal: 20,
    paddingTop: 18,
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
});
