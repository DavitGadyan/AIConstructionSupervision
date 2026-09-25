import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/lib/session";
import { ETA_HOURS, REPORT_HOURS } from "@/lib/api";
import { hoursLabel } from "@/lib/format";
import { animateLayout } from "@/lib/hooks";
import { theme } from "@/lib/theme";
import { Button, Pill, ProgressSegments } from "@/components/ui";

const poster = require("@/assets/images/tower-poster.png");

const ETA = hoursLabel(ETA_HOURS);
const REPORT = hoursLabel(REPORT_HOURS);

const STEPS: { title: string; body: string; pills?: [string, string] }[] = [
  {
    title: "Every floor, verified from the air",
    body: "Drone flights over your tower, compared floor by floor with the construction schedule. Lag shows up in days.",
  },
  {
    title: "Order an inspection from your phone",
    body: `Tap Order and a car with a drone crew pulls up in ${ETA}, anywhere in Yerevan & Kotayk. The price is shown before you confirm; paid by invoice.`,
    pills: [`${ETA} · crew on site`, `${REPORT} · independent report`],
  },
  {
    title: "Track it like a delivery",
    body: "Follow the crew, the flight and the report countdown live, with a notification at every step.",
  },
  {
    title: `An independent report within ${REPORT}`,
    body: "Every facade, the lagging floors and the drone shots that prove them, in a hashed PDF you can put in front of a bank or an inspector.",
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const { finishOnboarding } = useSession();
  const router = useRouter();

  const done = async () => {
    await finishOnboarding();
    router.replace("/login");
  };
  const next = () => {
    if (step >= STEPS.length - 1) return done();
    animateLayout();
    setStep((s) => s + 1);
  };
  const s = STEPS[step]!;

  return (
    <View style={styles.root}>
      {/* ORDI: a cut-out 3D object floating on a gradient ground, headline bottom-left. */}
      <LinearGradient colors={[theme.colors.ground, theme.colors.groundDeep, theme.colors.accent]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <Image
        source={poster}
        style={styles.poster}
        contentFit="contain"
        accessible
        accessibilityLabel="3D model of a tower under construction, reconstructed from drone photos"
      />
      <SafeAreaView style={styles.safe}>
        <ProgressSegments total={STEPS.length} current={step} label="Introduction, step" style={styles.segments} />
        <View style={{ flex: 1 }} />
        {s.pills ? (
          <View style={styles.pills}>
            <Pill text={s.pills[0]} tone="white" />
            <Pill text={s.pills[1]} tone="dark" />
          </View>
        ) : null}
        <Text style={styles.title} accessibilityRole="header" accessibilityLiveRegion="polite">
          {s.title}
        </Text>
        <Text style={styles.body}>{s.body}</Text>
        <View style={styles.buttons}>
          <Button title="Skip" variant="white" onPress={done} style={{ flex: 1 }} label="Skip introduction" />
          <Button
            title={step === STEPS.length - 1 ? "Get started" : "Next"}
            onPress={next}
            style={{ flex: 1 }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.ground },
  poster: { position: "absolute", top: "11%", right: "-6%", width: "86%", height: "52%" },
  safe: { flex: 1, paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.lg },
  segments: { paddingTop: theme.spacing.md },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs, marginBottom: theme.spacing.md },
  title: {
    fontFamily: theme.fonts.displayBold,
    fontSize: theme.type.hero,
    lineHeight: theme.type.hero * theme.type.leadingDisplay,
    color: theme.colors.onAccent,
    letterSpacing: -0.8,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.h3,
    lineHeight: theme.type.h3 * 1.4,
    color: theme.colors.overlayText,
    marginTop: theme.spacing.md,
  },
  buttons: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.xl },
});
