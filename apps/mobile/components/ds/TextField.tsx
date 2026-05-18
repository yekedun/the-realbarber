import { View, Text, TextInput, StyleSheet } from "react-native";
import { T, R, Type, S } from "../../lib/theme";

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  helper?: string;
  error?: string;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  secure = false,
  helper,
  error,
}: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{String(label).toUpperCase()}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={T.fg4}
        secureTextEntry={secure}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {(helper || error) && (
        <Text style={error ? styles.errorText : styles.helperText}>
          {error ?? helper}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: S.s1 + 2 },
  label: {
    fontSize: 11,
    fontFamily: Type.family,
    fontWeight: Type.weight.semibold,
    letterSpacing: 1.76,
    color: T.slate500,
  },
  input: {
    fontFamily: Type.family,
    fontSize: 15,
    color: T.fg1,
    backgroundColor: T.bgElevated,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: R.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputError: {
    borderColor: T.coral600,
  },
  helperText: {
    fontSize: 12,
    fontFamily: Type.family,
    color: T.fg3,
  },
  errorText: {
    fontSize: 12,
    fontFamily: Type.family,
    color: T.coral600,
  },
});
