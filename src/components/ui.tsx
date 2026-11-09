import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router, Stack } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { monthLabel } from '@/lib/fixed';
import { formatArs, formatUsd } from '@/lib/money';
import { dayKey, dayLabel, parseDay } from '@/lib/shared';
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

type MoneyProps = { amount: number; usdRate?: number | null; style?: StyleProp<TextStyle> };

/** ARS amount, tabular digits so columns line up. With `usdRate`, its USD estimate instead. */
export function Money({ amount, usdRate = null, style }: MoneyProps) {
  const c = useColors();

  return (
    <Text style={[type.body, { color: c.text, fontVariant: ['tabular-nums'] }, style]}>
      {formatUsd(amount, usdRate) ?? formatArs(amount)}
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
  /** Small chip after the title (`Fijo`). */
  badge?: string;
  right?: ReactNode;
  onPress?: () => void;
};

export function Row({ title, detail, icon, badge, right, onPress }: RowProps) {
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={[type.body, { color: c.text, flexShrink: 1 }]}>{title}</Text>
          {badge ? (
            <Text
              style={[
                type.caption,
                {
                  paddingHorizontal: space.sm,
                  borderRadius: radius.pill,
                  overflow: 'hidden',
                  backgroundColor: c.surface2,
                  color: c.muted,
                },
              ]}
            >
              {badge}
            </Text>
          ) : null}
        </View>
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
  const label = monthLabel(month);
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
      <IconButton
        glyph="‹"
        label="Mes anterior"
        onPress={() => shift(-1)}
        size={28}
        color={c.text}
      />
      <Text
        accessibilityLiveRegion="polite"
        style={[type.body, { fontWeight: '500', color: c.text }]}
      >
        {label}
      </Text>
      <IconButton
        glyph="›"
        label="Mes siguiente"
        onPress={() => shift(1)}
        size={28}
        color={c.text}
      />
    </View>
  );
}

type DaySelectorProps = {
  /** `YYYY-MM-DD`. */
  day: string;
  onChange: (day: string) => void;
  disabled?: boolean;
};

/**
 * `Fecha` field: shows `Hoy`, `Ayer` or the date and opens Android's calendar dialog. Never past
 * today: a movement is something that already happened, not one planned for tomorrow.
 */
export function DaySelector({ day, onChange, disabled = false }: DaySelectorProps) {
  const c = useColors();
  const label = dayLabel(day, new Date());

  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.caption, { color: c.muted }]}>Fecha</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Fecha: ${label}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        android_ripple={{ color: c.line }}
        onPress={() =>
          DateTimePickerAndroid.open({
            mode: 'date',
            value: parseDay(day),
            maximumDate: new Date(),
            positiveButton: { label: 'Aceptar' },
            negativeButton: { label: 'Cancelar' },
            // Only on Aceptar; cancelling keeps the day.
            onValueChange: (_event, picked) => onChange(dayKey(picked)),
          })
        }
        style={{
          minHeight: touch,
          justifyContent: 'center',
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: radius.field,
          backgroundColor: c.surface,
          overflow: 'hidden',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text style={[type.body, { color: c.text }]}>{label}</Text>
      </Pressable>
    </View>
  );
}

type IconButtonProps = {
  glyph: string;
  label: string;
  onPress: () => void;
  size?: number;
  /** Defaults to muted; header and month arrows use the text colour. */
  color?: string;
  disabled?: boolean;
};

// ponytail: Unicode glyphs instead of the design's SVG icons, like the label-only tabs. Swap
// for an icon set when one is installed.
export function IconButton({
  glyph,
  label,
  onPress,
  size = 20,
  color,
  disabled = false,
}: IconButtonProps) {
  const c = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: c.line, borderless: true }}
      style={{
        width: touch,
        height: touch,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <Text style={{ fontSize: size, lineHeight: size + 4, color: color ?? c.muted }}>{glyph}</Text>
    </Pressable>
  );
}

/** The household invite code, big enough to read out, long-press to copy (setup and Grupo familiar). */
export function InviteCode({ code, children }: { code: string; children?: ReactNode }) {
  const c = useColors();

  return (
    <Card>
      <Text style={[type.caption, { color: c.muted, textAlign: 'center' }]}>
        Código de invitación
      </Text>
      <Text
        selectable
        style={{
          fontSize: 40,
          lineHeight: 48,
          fontWeight: '700',
          letterSpacing: 8,
          textAlign: 'center',
          color: c.text,
        }}
      >
        {code}
      </Text>
      <Text style={[type.caption, { color: c.muted, textAlign: 'center', fontWeight: '400' }]}>
        Mantené presionado para copiarlo.
      </Text>
      {children}
    </Card>
  );
}

/** Header of a screen pushed over the tabs (Conceptos, Grupo familiar, Evolución). */
export function SubScreenHeader({ title }: { title: string }) {
  const c = useColors();

  return (
    <Stack.Screen
      options={{
        headerShown: true,
        title,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: c.bg },
        headerTitleStyle: type.title,
        // The native back button can't take a label; this one says "Volver".
        headerLeft: () => (
          <IconButton
            glyph="←"
            label="Volver"
            onPress={() => router.back()}
            size={24}
            color={c.text}
          />
        ),
      }}
    />
  );
}

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

/** Bottom sheet over a scrim; tapping the scrim or Android's back closes it. */
export function Sheet({ visible, onClose, title, subtitle, children }: SheetProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessible={false}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}
        />
        <View
          accessibilityViewIsModal
          style={{
            gap: space.lg,
            paddingTop: space.md,
            paddingHorizontal: space.lg,
            paddingBottom: space.xl + insets.bottom,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            backgroundColor: c.surface,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 32,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.line,
            }}
          />
          <View style={{ gap: space.xs }}>
            <Text accessibilityRole="header" style={[type.title, { color: c.text }]}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[type.label, { color: c.muted, fontWeight: '400' }]}>{subtitle}</Text>
            ) : null}
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
