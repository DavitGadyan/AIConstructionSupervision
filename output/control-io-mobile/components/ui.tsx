import { useState, type ComponentProps, type ReactNode, type Ref } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReduceMotion } from "@/lib/hooks";
import { theme } from "@/lib/theme";

export type FeatherName = ComponentProps<typeof Feather>["name"];

/* ------------------------------------------------------------------ ground */

/** ORDI's warm vertical gradient, re-cut in cool concrete. */
export function Ground({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      colors={[theme.colors.ground, theme.colors.groundDeep]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </LinearGradient>
  );
}

/* ------------------------------------------------------------------ cards */

// BlurView only where it is cheap: iOS and web. Android gets the plain
// translucent white, which reads the same on a flat gradient ground.
const canBlur = Platform.OS === "ios" || Platform.OS === "web";

export function GlassCard({
  children,
  style,
  blur = false,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  blur?: boolean;
  padded?: boolean;
}) {
  return (
    <View style={[styles.glass, padded && styles.cardPad, style]}>
      {blur && canBlur ? (
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
      ) : null}
      {children}
    </View>
  );
}

export function WhiteCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.white, styles.cardPad, style]}>{children}</View>;
}

export function AccentCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.accentCard, styles.cardPad, style]}>{children}</View>;
}

/** Card title row: title + subtitle left, square "↗" button right. */
export function CardHeader({
  title,
  subtitle,
  onArrow,
  arrowLabel,
  tone = "ink",
  right,
}: {
  title: string;
  subtitle?: string;
  onArrow?: () => void;
  arrowLabel?: string;
  tone?: "ink" | "onAccent" | "onWhite";
  right?: ReactNode;
}) {
  const onAccent = tone === "onAccent";
  return (
    <View style={styles.cardHeader}>
      <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
        <Text style={[styles.cardTitle, onAccent && { color: theme.colors.onAccent }]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.cardSub, onAccent && { color: theme.colors.onAccentMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onArrow ? (
        <SquareButton
          icon="arrow-up-right"
          onPress={onArrow}
          label={arrowLabel ?? `Open ${title}`}
          variant={onAccent ? "onAccent" : tone === "onWhite" ? "inner" : "white"}
        />
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ buttons */

/** Round white icon button (ORDI header). */
export function IconButton({
  icon,
  onPress,
  label,
  dot,
  active,
  children,
}: {
  icon?: FeatherName;
  onPress?: () => void;
  label: string;
  dot?: boolean;
  active?: boolean;
  children?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconBtn,
        active && { backgroundColor: theme.colors.accent },
        pressed && styles.pressed,
      ]}
    >
      {children ?? <Feather name={icon!} size={20} color={active ? theme.colors.onAccent : theme.colors.ink} />}
      {dot ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

/** Rounded-square icon button (ORDI ↗, pause/stop/+). */
export function SquareButton({
  icon,
  onPress,
  label,
  variant = "white",
  size = theme.tap,
  disabled,
}: {
  icon: FeatherName;
  onPress?: () => void;
  label: string;
  variant?: "white" | "soft" | "accent" | "onAccent" | "inner";
  size?: number;
  disabled?: boolean;
}) {
  const bg =
    variant === "accent"
      ? theme.colors.accent
      : variant === "soft"
        ? theme.colors.glassStrong
        : variant === "inner"
          ? theme.colors.inner
          : variant === "onAccent"
          ? theme.colors.onAccentCard
          : theme.colors.surface;
  const fg = variant === "accent" || variant === "onAccent" ? theme.colors.onAccent : theme.colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.square,
        { width: size, height: size, backgroundColor: bg },
        variant === "onAccent" && { borderWidth: 1, borderColor: theme.colors.onAccentBorder },
        disabled && { opacity: 0.4 },
        pressed && styles.pressed,
      ]}
    >
      <Feather name={icon} size={18} color={fg} />
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = "accent",
  icon,
  loading,
  disabled,
  style,
  label,
}: {
  title: string;
  onPress?: () => void;
  variant?: "accent" | "white" | "ghost" | "danger";
  icon?: FeatherName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  const bg =
    variant === "accent"
      ? theme.colors.accent
      : variant === "white"
        ? theme.colors.surface
        : variant === "danger"
          ? theme.colors.dangerSoft
          : theme.colors.transparent;
  const fg =
    variant === "accent" ? theme.colors.onAccent : variant === "danger" ? theme.colors.danger : theme.colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg },
        variant === "ghost" && { borderWidth: 1, borderColor: theme.colors.hairline },
        (disabled || loading) && { opacity: 0.55 },
        pressed && (variant === "accent" ? { backgroundColor: theme.colors.accentPressed } : styles.pressed),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={18} color={fg} style={{ marginRight: theme.spacing.sm }} /> : null}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** "Today ⌄" style select chip. */
export function SelectChip({ label, onPress, a11y }: { label: string; onPress?: () => void; a11y: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
      <Feather name="chevron-down" size={14} color={theme.colors.ink} />
    </Pressable>
  );
}

/** ORDI "8 Tasks" / "75%" pills. */
export function Pill({
  text,
  tone = "white",
  style,
}: {
  text: string;
  tone?: "white" | "dark" | "soft" | "ok" | "warn" | "danger" | "accent";
  style?: StyleProp<ViewStyle>;
}) {
  const map: Record<string, [string, string]> = {
    white: [theme.colors.surface, theme.colors.ink],
    dark: [theme.colors.dark, theme.colors.onAccent],
    soft: [theme.colors.inner, theme.colors.muted],
    accent: [theme.colors.accentSoft, theme.colors.accent],
    ok: [theme.colors.ok, theme.colors.onAccent],
    warn: [theme.colors.warn, theme.colors.onAccent],
    danger: [theme.colors.danger, theme.colors.onAccent],
  };
  const [bg, fg] = map[tone]!;
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text style={[styles.pillText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function StatusDot({ color, size = 12 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/* ------------------------------------------------------------------ states */

export function LoadingState({ label = "Loading…", style }: { label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.state, style]} accessibilityLiveRegion="polite">
      <ActivityIndicator color={theme.colors.accent} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  body,
  action,
  style,
}: {
  icon?: FeatherName;
  title: string;
  body?: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.state, style]}>
      <View style={styles.stateIcon}>
        <Feather name={icon} size={20} color={theme.colors.accent2} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      {body ? <Text style={styles.stateText}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  style,
}: {
  message: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.state, style]} accessibilityRole="alert">
      <View style={[styles.stateIcon, { backgroundColor: theme.colors.dangerSoft }]}>
        <Feather name="wifi-off" size={20} color={theme.colors.danger} />
      </View>
      <Text style={styles.stateTitle}>Something went wrong</Text>
      <Text style={styles.stateText}>{message}</Text>
      {onRetry ? <Button title="Try again" variant="white" icon="refresh-cw" onPress={onRetry} /> : null}
    </View>
  );
}

export function SectionLabel({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

/* ------------------------------------------------------------------ styles */

export const styles = StyleSheet.create({
  glass: {
    backgroundColor: theme.colors.glass,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    overflow: "hidden",
  },
  white: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    ...theme.shadow,
  },
  accentCard: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.card,
  },
  cardPad: { padding: theme.spacing.lg },
  cardHeader: { flexDirection: "row", alignItems: "flex-start" },
  cardTitle: {
    fontFamily: theme.fonts.displaySemi,
    fontSize: theme.type.h3 + 2,
    color: theme.colors.ink,
    letterSpacing: -0.3,
  },
  cardSub: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small + 1,
    color: theme.colors.muted,
    marginTop: theme.spacing.xxs,
  },
  iconBtn: {
    width: theme.iconButton,
    height: theme.iconButton,
    borderRadius: theme.radius.inner,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 12,
    right: 13,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
  },
  square: {
    borderRadius: theme.radius.btn,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  btn: {
    minHeight: 52,
    borderRadius: theme.radius.btn,
    paddingHorizontal: theme.spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontFamily: theme.fonts.bodySemi, fontSize: theme.type.label },
  chip: {
    minHeight: theme.tap,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    maxWidth: 170,
  },
  chipText: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small, color: theme.colors.ink },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    alignSelf: "flex-start",
  },
  pillText: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.micro + 1 },
  state: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  stateIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xs,
  },
  stateTitle: {
    fontFamily: theme.fonts.displaySemi,
    fontSize: theme.type.h3,
    color: theme.colors.ink,
    textAlign: "center",
  },
  stateText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    textAlign: "center",
    lineHeight: theme.type.label * theme.type.leadingBody,
    marginBottom: theme.spacing.sm,
  },
  sectionLabel: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.type.micro,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: theme.colors.muted,
  },
});

/* ================================================================== v1.1 primitives */

/* ------------------------------------------------------------------ Segmented */

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** small count badge, e.g. open orders */
  count?: number;
  /** screen-reader label when `label` alone is ambiguous */
  a11y?: string;
}

/**
 * ORDI segmented control: glass track, the selected segment a white pill.
 * `role="tab"` for view switches (Activity: Orders / Reports), `"radio"` for
 * a choice inside a form.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  role = "tab",
  style,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** accessible name of the group */
  label: string;
  role?: "tab" | "radio";
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[ns.segTrack, style]}
      accessibilityRole={role === "tab" ? "tablist" : "radiogroup"}
      accessibilityLabel={label}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => !selected && onChange(o.value)}
            accessibilityRole={role}
            accessibilityState={role === "tab" ? { selected } : { checked: selected }}
            accessibilityLabel={o.a11y ?? (o.count !== undefined ? `${o.label}, ${o.count}` : o.label)}
            style={({ pressed }) => [ns.seg, selected && ns.segOn, pressed && !selected && { opacity: 0.7 }]}
          >
            <Text style={[ns.segText, selected && ns.segTextOn]} numberOfLines={1}>
              {o.label}
            </Text>
            {o.count !== undefined && o.count > 0 ? (
              <View style={[ns.segCount, selected && { backgroundColor: theme.colors.accent }]}>
                <Text style={[ns.segCountText, selected && { color: theme.colors.onAccent }]}>{o.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ TextField */

export type TextFieldProps = Omit<TextInputProps, "style" | "onChangeText" | "value"> & {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  /** helper line under the field (hidden while an error shows) */
  hint?: string;
  /** validation message: red border + announced politely */
  error?: string | null;
  /** leading Feather icon */
  icon?: FeatherName;
  /** adds "Optional" next to the label */
  optional?: boolean;
  /** ref to the underlying TextInput (focus the next field on submit) */
  inputRef?: Ref<TextInput>;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

/** Labelled text input on a white inner card; 52pt tall, 16px text (no iOS zoom on web). */
export function TextField({
  label,
  value,
  onChangeText,
  hint,
  error,
  icon,
  optional,
  inputRef,
  style,
  inputStyle,
  multiline,
  editable = true,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const help = error || hint;
  return (
    <View style={[{ gap: theme.spacing.xs + 2 }, style]}>
      <View style={ns.fieldLabelRow}>
        <Text style={ns.fieldLabel} importantForAccessibility="no" accessibilityElementsHidden>
          {label}
        </Text>
        {optional ? <Text style={ns.fieldOptional}>Optional</Text> : null}
      </View>
      <View
        style={[
          ns.field,
          multiline && ns.fieldMulti,
          focused && ns.fieldFocus,
          !!error && ns.fieldError,
          !editable && { opacity: 0.6 },
        ]}
      >
        {icon ? (
          <Feather
            name={icon}
            size={18}
            color={error ? theme.colors.danger : focused ? theme.colors.accent : theme.colors.muted}
            style={multiline ? { marginTop: 2 } : undefined}
          />
        ) : null}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          multiline={multiline}
          placeholderTextColor={theme.colors.faint}
          selectionColor={theme.colors.accent}
          cursorColor={theme.colors.accent}
          accessibilityLabel={`${label}${optional ? ", optional" : ""}${error ? ", invalid" : ""}`}
          accessibilityHint={help || undefined}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[ns.input, multiline && ns.inputMulti, inputStyle]}
          textAlignVertical={multiline ? "top" : "center"}
          {...rest}
        />
      </View>
      {help ? (
        <Text
          style={[ns.fieldHelp, !!error && { color: theme.colors.danger }]}
          accessibilityLiveRegion={error ? "polite" : "none"}
        >
          {help}
        </Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ ChoiceCard */

/**
 * Selectable option card (order kind, ASAP vs scheduled). Selected: white card
 * with an accent ring and check; idle: glass. Works as a radio by default.
 */
export function ChoiceCard({
  title,
  body,
  icon,
  meta,
  badge,
  selected,
  onPress,
  disabled,
  role = "radio",
  a11yHint,
  children,
  style,
}: {
  title: string;
  body?: string;
  icon?: FeatherName;
  /** right-aligned secondary line, e.g. "from 90 000 AMD" */
  meta?: string;
  /** small pill after the title, e.g. "8 open findings" */
  badge?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  role?: "radio" | "checkbox";
  a11yHint?: string;
  /** extra content under the body (only rendered when selected), e.g. focus chips */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityLabel={[title, badge, body, meta].filter(Boolean).join(". ")}
      accessibilityHint={a11yHint}
      style={({ pressed }) => [
        ns.choice,
        selected ? ns.choiceOn : ns.choiceOff,
        disabled && { opacity: 0.45 },
        pressed && !disabled && { transform: [{ scale: 0.99 }], opacity: 0.9 },
        style,
      ]}
    >
      <View style={ns.choiceRow}>
        {icon ? (
          <View style={[ns.choiceIcon, selected && { backgroundColor: theme.colors.accentSoft }]}>
            <Feather name={icon} size={20} color={selected ? theme.colors.accent : theme.colors.ink} />
          </View>
        ) : null}
        <View style={{ flex: 1, gap: theme.spacing.xxs + 1 }}>
          <View style={ns.choiceTitleRow}>
            <Text style={ns.choiceTitle}>{title}</Text>
            {badge ? <Pill text={badge} tone={selected ? "accent" : "soft"} /> : null}
          </View>
          {body ? <Text style={ns.choiceBody}>{body}</Text> : null}
          {meta ? <Text style={ns.choiceMeta}>{meta}</Text> : null}
        </View>
        <View style={[ns.check, selected && ns.checkOn]}>
          {selected ? <Feather name="check" size={14} color={theme.colors.onAccent} /> : null}
        </View>
      </View>
      {selected && children ? <View style={{ marginTop: theme.spacing.md }}>{children}</View> : null}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ KeyValueRow */

/**
 * Label over value, optional leading icon and trailing action (tap to call,
 * mail, open website). Missing values show a faint placeholder, not a dash.
 */
export function KeyValueRow({
  label,
  value,
  placeholder = "Not set",
  icon,
  onPress,
  actionIcon,
  actionLabel,
  divider = true,
  numberOfLines = 2,
  style,
}: {
  label: string;
  value?: string | number | null;
  placeholder?: string;
  icon?: FeatherName;
  onPress?: () => void;
  /** trailing icon; defaults to chevron-right when onPress is set */
  actionIcon?: FeatherName;
  /** what the tap does, for screen readers: "Call", "Send email" */
  actionLabel?: string;
  /** hairline under the row (turn off for the last row) */
  divider?: boolean;
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const has = value !== null && value !== undefined && value !== "";
  const shown = has ? String(value) : placeholder;
  const tappable = !!onPress && has;
  const content = (
    <>
      {icon ? (
        <View style={ns.kvIcon}>
          <Feather name={icon} size={16} color={theme.colors.accent2} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={ns.kvLabel}>{label}</Text>
        <Text style={[ns.kvValue, !has && ns.kvPlaceholder]} numberOfLines={numberOfLines}>
          {shown}
        </Text>
      </View>
      {tappable ? (
        <Feather name={actionIcon ?? "chevron-right"} size={18} color={theme.colors.accent} />
      ) : null}
    </>
  );
  const rowStyle = [ns.kv, divider && ns.kvDivider, style];
  if (!tappable) {
    return (
      <View style={rowStyle} accessible accessibilityLabel={`${label}: ${shown}`}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={actionIcon === "external-link" || actionIcon === "globe" ? "link" : "button"}
      accessibilityLabel={`${label}: ${shown}`}
      accessibilityHint={actionLabel}
      style={({ pressed }) => [...rowStyle, pressed && { opacity: 0.65 }]}
    >
      {content}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ ProgressSegments */

/**
 * ORDI onboarding progress: one bar per step, filled up to the current one.
 * `current` is 0-based.
 */
export function ProgressSegments({
  total,
  current,
  label = "Step",
  tone = "accent",
  style,
}: {
  total: number;
  current: number;
  /** spoken as "{label} 2 of 4" */
  label?: string;
  tone?: "accent" | "onAccent";
  style?: StyleProp<ViewStyle>;
}) {
  const on = tone === "onAccent" ? theme.colors.onAccent : theme.colors.accent;
  const off = tone === "onAccent" ? theme.colors.onAccentBorder : theme.colors.surface;
  const now = Math.min(total, Math.max(1, current + 1));
  return (
    <View
      style={[ns.segBars, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label} ${now} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now, text: `${label} ${now} of ${total}` }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[ns.segBar, { backgroundColor: i <= current ? on : off }]} />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ BackHeader */

/**
 * Stack-screen header: square white back button, title + subtitle, optional
 * right slot. Back falls back to Home when there is no history (deep link).
 */
export function BackHeader({
  title,
  subtitle,
  onBack,
  backLabel = "Back",
  icon = "chevron-left",
  right,
  style,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  /** "x" for modal-like flows (the order wizard) */
  icon?: "chevron-left" | "x" | "arrow-left";
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")));
  return (
    <View style={[ns.backRow, style]}>
      <SquareButton icon={icon} label={backLabel} onPress={back} size={theme.iconButton} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={ns.backTitle} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={ns.backSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/* ------------------------------------------------------------------ Sheet */

/**
 * Bottom sheet on a dim scrim: the viewer "why can't I order" explanation,
 * cancel confirmation. Fades (no slide) under Reduce Motion; Android back and
 * the scrim close it.
 */
export function Sheet({
  visible,
  onClose,
  title,
  body,
  icon,
  tone = "default",
  children,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  body?: string;
  icon?: FeatherName;
  tone?: "default" | "danger";
  children?: ReactNode;
  /** buttons row(s) at the bottom */
  actions?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const danger = tone === "danger";
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduce ? "none" : "fade"}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={ns.scrimWrap}>
        <Pressable style={ns.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View
          style={[ns.sheet, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) + theme.spacing.sm }]}
          accessibilityViewIsModal
        >
          <View style={ns.grabber} />
          <ScrollView bounces={false} contentContainerStyle={{ gap: theme.spacing.md }} style={{ flexGrow: 0 }}>
            {icon ? (
              <View style={[ns.sheetIcon, danger && { backgroundColor: theme.colors.dangerSoft }]}>
                <Feather name={icon} size={22} color={danger ? theme.colors.danger : theme.colors.accent} />
              </View>
            ) : null}
            <Text style={ns.sheetTitle} accessibilityRole="header">
              {title}
            </Text>
            {body ? <Text style={ns.sheetBody}>{body}</Text> : null}
            {children}
          </ScrollView>
          {actions ? <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>{actions}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const ns = StyleSheet.create({
  segTrack: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: theme.radius.btn + 4,
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  seg: {
    flex: 1,
    minHeight: theme.tap,
    borderRadius: theme.radius.btn,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.sm,
  },
  segOn: { backgroundColor: theme.colors.surface, ...theme.shadow, shadowOpacity: 0.06, elevation: 1 },
  segText: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.label - 1, color: theme.colors.muted },
  segTextOn: { fontFamily: theme.fonts.bodySemi, color: theme.colors.ink },
  segCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: theme.colors.track,
    alignItems: "center",
    justifyContent: "center",
  },
  segCountText: { fontFamily: theme.fonts.bodySemi, fontSize: theme.type.micro, color: theme.colors.ink },

  fieldLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  fieldLabel: { fontFamily: theme.fonts.bodySemi, fontSize: theme.type.small, color: theme.colors.ink },
  fieldOptional: { fontFamily: theme.fonts.body, fontSize: theme.type.small - 1, color: theme.colors.muted },
  field: {
    minHeight: theme.field,
    borderRadius: theme.radius.btn,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.transparent,
    paddingHorizontal: theme.spacing.md + 2,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm + 2,
  },
  fieldMulti: { alignItems: "flex-start", paddingVertical: theme.spacing.md, minHeight: 104 },
  fieldFocus: { borderColor: theme.colors.accent },
  fieldError: { borderColor: theme.colors.danger },
  input: {
    flex: 1,
    alignSelf: "stretch",
    fontFamily: theme.fonts.body,
    fontSize: theme.type.body,
    color: theme.colors.ink,
    paddingVertical: 0,
    minHeight: theme.field - 4,
    // web: drop the browser focus ring, the border above is the ring
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  inputMulti: { minHeight: 76, lineHeight: theme.type.body * theme.type.leadingBody },
  fieldHelp: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    lineHeight: theme.type.small * 1.4,
    color: theme.colors.muted,
  },

  choice: {
    borderRadius: theme.radius.inner + 6,
    padding: theme.spacing.lg,
    borderWidth: 2,
  },
  choiceOn: { backgroundColor: theme.colors.surface, borderColor: theme.colors.accent, ...theme.shadow },
  choiceOff: { backgroundColor: theme.colors.glassStrong, borderColor: theme.colors.glassBorder },
  choiceRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md },
  choiceIcon: {
    width: theme.tap,
    height: theme.tap,
    borderRadius: theme.radius.btn,
    backgroundColor: theme.colors.inner,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: theme.spacing.sm },
  choiceTitle: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h3, color: theme.colors.ink },
  choiceBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small + 1,
    lineHeight: (theme.type.small + 1) * 1.42,
    color: theme.colors.muted,
  },
  choiceMeta: { fontFamily: theme.fonts.bodySemi, fontSize: theme.type.small + 1, color: theme.colors.ink, marginTop: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },

  kv: {
    minHeight: theme.field + 4,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
  },
  kvDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.hairline },
  kvIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill + 2,
    backgroundColor: theme.colors.inner,
    alignItems: "center",
    justifyContent: "center",
  },
  kvLabel: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted },
  kvValue: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.type.label,
    color: theme.colors.ink,
    marginTop: 2,
  },
  kvPlaceholder: { color: theme.colors.faint, fontFamily: theme.fonts.body },

  segBars: { flexDirection: "row", gap: 6 },
  segBar: { flex: 1, height: 4, borderRadius: 2 },

  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  backTitle: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h2, color: theme.colors.ink, letterSpacing: -0.3 },
  backSub: { fontFamily: theme.fonts.body, fontSize: theme.type.small, color: theme.colors.muted, marginTop: 1 },

  scrimWrap: { flex: 1, justifyContent: "flex-end" },
  scrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: theme.colors.overlay },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.card,
    borderTopRightRadius: theme.radius.card,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
    maxHeight: "85%",
    ...theme.shadow,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.track,
    marginBottom: theme.spacing.lg,
  },
  sheetIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.btn,
    backgroundColor: theme.colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: { fontFamily: theme.fonts.displaySemi, fontSize: theme.type.h2, color: theme.colors.ink },
  sheetBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.label,
    lineHeight: theme.type.label * theme.type.leadingBody,
    color: theme.colors.muted,
  },
});
