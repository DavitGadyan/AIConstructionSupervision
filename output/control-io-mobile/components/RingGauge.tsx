import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { useReduceMotion } from "@/lib/hooks";
import { theme } from "@/lib/theme";

/**
 * ORDI "Time Tracker" ring re-purposed as schedule variance.
 * - accent arc: earned progress (0-100)
 * - grey tick on the ring: where the plan says we should be
 * - dotted inner dial: ORDI's clock dots
 * - centre: big number + caption
 */
export function RingGauge({
  value,
  caption,
  earnedPct,
  plannedPct,
  size = 220,
}: {
  value: string;
  caption: string;
  earnedPct: number;
  plannedPct?: number;
  size?: number;
}) {
  const stroke = 4;
  const r = size / 2 - stroke * 2;
  const c = 2 * Math.PI * r;
  const reduce = useReduceMotion();
  const target = Math.max(0, Math.min(100, earnedPct || 0));
  const anim = useRef(new Animated.Value(reduce ? target : 0)).current;
  const [shown, setShown] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      anim.setValue(target);
      setShown(target);
      return;
    }
    const id = anim.addListener(({ value: v }) => setShown(v));
    Animated.timing(anim, {
      toValue: target,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [target, reduce, anim]);

  const dash = (shown / 100) * c;
  const dots = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const rr = r - 26;
    return { x: size / 2 + rr * Math.cos(a), y: size / 2 + rr * Math.sin(a), big: i % 6 === 0 };
  });
  const plannedAngle = ((plannedPct ?? 0) / 100) * Math.PI * 2 - Math.PI / 2;

  return (
    <View
      style={{ width: size, height: size, alignSelf: "center" }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${value} ${caption}. Earned ${target.toFixed(1)} percent${
        plannedPct !== undefined ? `, planned ${plannedPct.toFixed(1)} percent` : ""
      }`}
    >
      <Svg width={size} height={size}>
        {/* soft glass disc */}
        <Circle cx={size / 2} cy={size / 2} r={r - 8} fill={theme.colors.glass} />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.colors.track} strokeWidth={stroke} fill="none" />
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={theme.colors.accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${dash} ${c}`}
          />
        </G>
        {dots.map((d, i) => (
          <Circle key={i} cx={d.x} cy={d.y} r={d.big ? 2.2 : 1.3} fill={d.big ? theme.colors.surface : theme.colors.faint} />
        ))}
        {plannedPct !== undefined ? (
          <Circle
            cx={size / 2 + r * Math.cos(plannedAngle)}
            cy={size / 2 + r * Math.sin(plannedAngle)}
            r={6}
            fill={theme.colors.surface}
            stroke={theme.colors.accent2}
            strokeWidth={3}
          />
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centre]} pointerEvents="none">
        <Text style={styles.value} adjustsFontSizeToFit numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.caption}>{caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: "center", justifyContent: "center" },
  value: {
    fontFamily: theme.fonts.displaySemi,
    fontSize: theme.type.gauge,
    color: theme.colors.ink,
    letterSpacing: -1,
  },
  caption: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.type.micro,
    letterSpacing: 0.8,
    color: theme.colors.ink,
    marginTop: theme.spacing.xxs,
  },
});
