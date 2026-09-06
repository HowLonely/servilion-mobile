import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
};

export function Button({
  label,
  onPress,
  icon: Icon,
  disabled = false,
  loading = false,
  variant = 'primary',
}: ButtonProps) {
  const palette = variant === 'primary'
    ? styles.primary
    : variant === 'danger' ? styles.danger : styles.secondary;
  const textPalette = variant === 'secondary' ? styles.secondaryText : styles.primaryText;
  const contentColor = variant === 'secondary' ? colors.ink : colors.surface;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, palette, (pressed || disabled) && styles.buttonMuted]}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <>
          {Icon ? <Icon size={20} color={contentColor} /> : null}
          <Text style={[styles.buttonText, textPalette]} numberOfLines={2}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function StatusTag({ online }: { online: boolean }) {
  return (
    <View style={[styles.tag, online ? styles.online : styles.offline]}>
      <View style={[styles.dot, { backgroundColor: online ? colors.success : colors.warning }]} />
      <Text style={styles.tagText}>{online ? 'Con conexión' : 'Modo offline'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  danger: { backgroundColor: colors.danger },
  buttonMuted: { opacity: 0.55 },
  buttonText: { fontFamily: fonts.bodyMedium, fontSize: 17, textAlign: 'center' },
  primaryText: { color: colors.surface },
  secondaryText: { color: colors.ink },
  tag: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  online: { backgroundColor: colors.successSoft },
  offline: { backgroundColor: colors.warningSoft },
  dot: { width: 7, height: 7, borderRadius: 4 },
  tagText: { color: colors.inkSoft, fontFamily: fonts.bodyMedium, fontSize: 13 },
});