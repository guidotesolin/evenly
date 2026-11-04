import type { ReactNode } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { formatArs } from '@/lib/money';
import { radius, space, touch, type, useColors } from '@/theme';

// Base components of the approved design (ARCHITECTURE.md § Design and UI copy). Screens compose
// these instead of styling raw primitives.

type ScreenProps = {
  children: ReactNode;
  /** Tab screens pass `[]`: the header and tab bar already cover the insets. */
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
};

export function Screen({ children, edges = ['top', 'bottom'], style }: ScreenProps) {
  const c = useColors();

  return (
    <SafeAreaView
      edges={edges}
      style={[{ flex: 1, backgroundColor: c.bg, padding: space.lg, gap: space.lg }, style]}
    >
      {children}
    </SafeAreaView>
  );
}

/** Rounded surface that groups related content (a form section, a total). */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();

  return (
    <View
      style={[
        {
          gap: space.md,
          padding: space.lg,
          borderRadius: radius.field,
          backgroundColor: c.surface,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type MoneyProps = { amount: number; style?: StyleProp<TextStyle> };

/** ARS amount, tabular digits so columns line up. */
export function Money({ amount, style }: MoneyProps) {
  const c = useColors();

  return (
    <Text style={[type.body, { color: c.text, fontVariant: ['tabular-nums'] }, style]}>
      {formatArs(amount)}
    </Text>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text' | 'danger';
  disabled?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled = false }: ButtonProps) {
  const c = useColors();

  const look = {
    primary: { bg: c.accent, fg: c.onAccent, border: c.accent },
    secondary: { bg: c.surface, fg: c.text, border: c.line },
    text: { bg: 'transparent', fg: c.accent, border: 'transparent' },
    danger: { bg: 'transparent', fg: c.warn, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: c.line, borderless: false }}
      style={{
        minHeight: touch,
        paddingHorizontal: space.xl,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: look.border,
        backgroundColor: look.bg,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={[type.label, { color: look.fg }]}>{title}</Text>
    </Pressable>
  );
}

type InputProps = TextInputProps & { label: string };

/** Labelled text field; the label is also the accessibility label. */
export function Input({ label, style, ...props }: InputProps) {
  const c = useColors();

  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.caption, { color: c.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        cursorColor={c.accent}
        selectionColor={c.accentSoft}
        style={[
          type.body,
          {
            minHeight: touch,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: radius.field,
            backgroundColor: c.surface,
            color: c.text,
          },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

type RowProps = {
  title: string;
  detail?: string;
  /** Emoji or initial shown in a circle; omitted rows have no circle. */
  icon?: string;
  right?: ReactNode;
  onPress?: () => void;
};

export function Row({ title, detail, icon, right, onPress }: RowProps) {
  const c = useColors();

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      android_ripple={{ color: c.line }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: 60,
        paddingVertical: space.sm,
        paddingHorizontal: space.lg,
        backgroundColor: c.surface,
        borderBottomWidth: 1,
        borderBottomColor: c.line,
      }}
    >
      {icon !== undefined && (
        <View
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            backgroundColor: c.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 20, lineHeight: 24, fontWeight: '500', color: c.muted }}>
            {icon}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.body, { color: c.text }]}>{title}</Text>
        {detail ? <Text style={[type.caption, { color: c.muted }]}>{detail}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

type MonthSelectorProps = {
  /** First day of the month. */
  month: Date;
  onChange: (month: Date) => void;
};

export function MonthSelector({ month, onChange }: MonthSelectorProps) {
  const c = useColors();
  const label = `${month.toLocaleDateString('es-AR', { month: 'long' })} ${month.getFullYear()}`;
  const shift = (by: number) => onChange(new Date(month.getFullYear(), month.getMonth() + by, 1));

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: radius.field,
        backgroundColor: c.surface,
      }}
    >
      <Arrow glyph="‹" label="Mes anterior" onPress={() => shift(-1)} />
      <Text
        accessibilityLiveRegion="polite"
        style={[type.body, { fontWeight: '500', color: c.text }]}
      >
        {label}
      </Text>
      <Arrow glyph="›" label="Mes siguiente" onPress={() => shift(1)} />
    </View>
  );
}

type ArrowProps = { glyph: string; label: string; onPress: () => void };

function Arrow({ glyph, label, onPress }: ArrowProps) {
  const c = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: c.line, borderless: true }}
      style={{ width: touch, height: touch, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontSize: 28, lineHeight: 32, color: c.text }}>{glyph}</Text>
    </Pressable>
  );
}
