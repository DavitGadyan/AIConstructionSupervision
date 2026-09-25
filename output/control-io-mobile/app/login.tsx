import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { API_URL } from "@/lib/api";
import { useSession } from "@/lib/session";
import { theme } from "@/lib/theme";
import { Button, GlassCard, Ground } from "@/components/ui";

export default function Login() {
  const { signIn } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("demo@control.io");
  const [password, setPassword] = useState("demo1234");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace("/projects");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Ground>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.logo}>
              <Feather name="crosshair" size={26} color={theme.colors.onAccent} />
            </View>
            <Text style={styles.title} accessibilityRole="header">
              Sign in to control.io
            </Text>
            <Text style={styles.sub}>Site supervision from the air. Use your organisation account.</Text>

            <GlassCard blur style={{ gap: theme.spacing.md, marginTop: theme.spacing.xl }}>
              <View>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="username"
                  style={styles.input}
                  accessibilityLabel="Email"
                  placeholderTextColor={theme.colors.faint}
                  returnKeyType="next"
                />
              </View>
              <View>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  textContentType="password"
                  style={styles.input}
                  accessibilityLabel="Password"
                  placeholderTextColor={theme.colors.faint}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                />
              </View>
              {error ? (
                <Text style={styles.error} accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
              <Button title="Sign in" onPress={submit} loading={busy} disabled={!email || !password} />
            </GlassCard>
            <Text style={styles.server}>Server: {API_URL}</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Ground>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: theme.spacing.xl, paddingTop: theme.spacing.xxl * 2, flexGrow: 1 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.inner,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontFamily: theme.fonts.displayBold,
    fontSize: theme.type.display,
    lineHeight: theme.type.display * theme.type.leadingDisplay,
    color: theme.colors.ink,
    letterSpacing: -0.6,
  },
  sub: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.body,
    color: theme.colors.muted,
    marginTop: theme.spacing.sm,
    lineHeight: theme.type.body * theme.type.leadingBody,
  },
  label: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.type.small,
    color: theme.colors.muted,
    marginBottom: theme.spacing.xs,
  },
  input: {
    minHeight: 52,
    borderRadius: theme.radius.btn,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    fontFamily: theme.fonts.body,
    fontSize: theme.type.body,
    color: theme.colors.ink,
  },
  error: { fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.label, color: theme.colors.danger },
  server: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    color: theme.colors.muted,
    textAlign: "center",
    marginTop: theme.spacing.xl,
  },
});
