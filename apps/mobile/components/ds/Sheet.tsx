import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { T, R, Type, S } from "../../lib/theme";

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Sheet({ visible, onClose, title, children, footer }: SheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.panel, { maxHeight: "78%" }]} onPress={() => {}}>
          <View style={styles.handle} />
          {title && (
            <View style={styles.titleRow}>
              <Text style={styles.titleText}>{title}</Text>
              <Pressable onPress={onClose}>
                <Text style={styles.cancelText}>İptal</Text>
              </Pressable>
            </View>
          )}
          <ScrollView contentContainerStyle={styles.body}>
            {children}
          </ScrollView>
          {footer && <View style={styles.footer}>{footer}</View>}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,20,16,0.36)",
    justifyContent: "flex-end",
  },
  panel: {
    backgroundColor: T.bgElevated,
    borderTopLeftRadius: R.lg,
    borderTopRightRadius: R.lg,
    paddingTop: 12,
    paddingBottom: 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: T.slate200,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: S.s5,
    paddingBottom: 12,
  },
  titleText: {
    fontSize: 20,
    fontFamily: Type.family,
    fontWeight: Type.weight.bold,
    letterSpacing: -0.3,
    color: T.fg1,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: Type.family,
    fontWeight: Type.weight.semibold,
    color: T.slate500,
  },
  body: {
    paddingHorizontal: S.s5,
  },
  footer: {
    paddingHorizontal: S.s5,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: T.divider,
    marginTop: 18,
  },
});
