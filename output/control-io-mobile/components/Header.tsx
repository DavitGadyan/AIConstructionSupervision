import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useSession } from "@/lib/session";
import { useLive } from "@/lib/live";
import { initials } from "@/lib/format";
import { theme } from "@/lib/theme";
import { IconButton } from "./ui";

/**
 * ORDI header row: switch project + live waveform (flights) on the left, bell
 * (Activity) with accent dot and the avatar (Company) on the right. The app
 * has no search, so ORDI's search slot carries the same swap glyph as the
 * Project screen's "Switch project" button.
 * `alert` lights the bell dot (new delay findings or a running order).
 */
export function Header({ alert }: { alert?: boolean }) {
  const router = useRouter();
  const { user, company, project } = useSession();
  const live = useLive();
  const liveOn = live.mode === "streaming" || live.mode === "polling" || live.mode === "connecting";
  const org = company?.name ?? user?.org?.name;

  return (
    <View style={styles.row}>
      <View style={styles.group}>
        <IconButton
          icon="repeat"
          label={project ? `Switch project, current: ${project.name}` : "Choose a project"}
          onPress={() => router.push("/projects")}
        />
        <IconButton
          label={liveOn ? "Live feed on, open flights" : "Live feed paused, open flights"}
          onPress={() => router.push("/flights")}
          dot={liveOn && live.freshShotIds.size > 0}
        >
          <MaterialCommunityIcons
            name="waveform"
            size={22}
            color={liveOn ? theme.colors.accent : theme.colors.ink}
          />
        </IconButton>
      </View>
      <View style={styles.group}>
        <IconButton
          icon="bell"
          label={alert ? "Activity, new updates" : "Activity: orders and reports"}
          dot={alert}
          onPress={() => router.push("/activity" as Href)}
        />
        <Pressable
          onPress={() => router.push("/company" as Href)}
          accessibilityRole="button"
          accessibilityLabel={`Company and account: ${user?.name ?? "signed in"}${org ? `, ${org}` : ""}`}
          hitSlop={4}
          style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.avatarText}>{initials(user?.name)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.xs,
  },
  group: { flexDirection: "row", gap: theme.spacing.sm },
  avatar: {
    width: theme.iconButton,
    height: theme.iconButton,
    borderRadius: theme.radius.inner,
    backgroundColor: theme.colors.accent2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  avatarText: { fontFamily: theme.fonts.displayBold, color: theme.colors.onAccent, fontSize: theme.type.label },
});
