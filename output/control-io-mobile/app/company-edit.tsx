import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { errorMessage, isApiError, type Company, type CompanyPatch } from "@/lib/api";
import { announce } from "@/lib/hooks";
import { canEditCompany } from "@/lib/roles";
import { useSession } from "@/lib/session";
import { theme } from "@/lib/theme";
import {
  BackHeader,
  Button,
  EmptyState,
  ErrorState,
  GlassCard,
  Ground,
  LoadingState,
  SectionLabel,
  Sheet,
  TextField,
  type FeatherName,
} from "@/components/ui";

/* ------------------------------------------------------------------ rules (mirror CompanyPatchSchema) */

type Field = "name" | "legalName" | "taxId" | "address" | "phone" | "email" | "website";
type Values = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;

const FIELDS: readonly Field[] = ["name", "legalName", "taxId", "address", "phone", "email", "website"];
const MAX: Record<Field, number> = { name: 120, legalName: 200, taxId: 40, address: 300, phone: 20, email: 200, website: 200 };
const PHONE_RE = /^[0-9+\-() ]{6,20}$/;
const EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const WEB_RE = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i;

function validateField(f: Field, raw: string): string | undefined {
  const v = raw.trim();
  if (f === "name" && !v) return "The company needs a name.";
  if (v.length > MAX[f]) return `Keep it under ${MAX[f]} characters.`;
  if (!v) return undefined; // "" clears an optional field
  if (f === "phone") {
    if (!PHONE_RE.test(v)) return "Use digits, spaces and + - ( ), 6-20 characters.";
    if ((v.match(/\d/g)?.length ?? 0) < 6) return "A phone number needs at least 6 digits.";
  }
  if (f === "email" && !EMAIL_RE.test(v)) return "Not a valid email address.";
  if (f === "website" && !WEB_RE.test(v)) return "Not a valid website address, e.g. example.am";
  return undefined;
}

function valuesOf(c: Company): Values {
  return {
    name: c.name ?? "",
    legalName: c.legalName ?? "",
    taxId: c.taxId ?? "",
    address: c.address ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    website: c.website ?? "",
  };
}

/* ------------------------------------------------------------------ screen */

export default function CompanyEditScreen() {
  const { ready, token } = useSession();
  if (!ready) return null;
  if (!token) return <Redirect href="/login" />;
  return <CompanyEdit />;
}

function CompanyEdit() {
  const router = useRouter();
  const { company, companyLoading, companyError, refreshCompany, updateCompany, role } = useSession();
  const close = () => (router.canGoBack() ? router.back() : router.replace("/company"));

  const content = !company ? (
    <GlassCard>
      {companyError && !companyLoading ? (
        <ErrorState message={companyError} onRetry={() => refreshCompany()} />
      ) : (
        <LoadingState label="Loading company…" />
      )}
    </GlassCard>
  ) : !canEditCompany({ role }) ? (
    <GlassCard>
      <EmptyState
        icon="lock"
        title="Only owners can edit"
        body={`Ask an owner at ${company.name} to update the company profile, or to make you an owner.`}
        action={<Button title="Back" variant="white" onPress={close} />}
      />
    </GlassCard>
  ) : null;

  if (content || !company) {
    return (
      <Ground>
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          <View style={styles.top}>
            <BackHeader icon="x" backLabel="Close" onBack={close} title="Edit company" />
          </View>
          <ScrollView contentContainerStyle={styles.content}>{content}</ScrollView>
        </SafeAreaView>
      </Ground>
    );
  }
  return <Form company={company} onSave={updateCompany} onDone={close} />;
}

function Form({
  company,
  onSave,
  onDone,
}: {
  company: Company;
  onSave: (patch: CompanyPatch) => Promise<Company>;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const initial = useMemo(() => valuesOf(company), [company.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const refs = {
    name: useRef<TextInput>(null),
    legalName: useRef<TextInput>(null),
    taxId: useRef<TextInput>(null),
    address: useRef<TextInput>(null),
    phone: useRef<TextInput>(null),
    email: useRef<TextInput>(null),
    website: useRef<TextInput>(null),
  } satisfies Record<Field, React.RefObject<TextInput | null>>;

  const patch: CompanyPatch = useMemo(() => {
    const p: CompanyPatch = {};
    for (const f of FIELDS) {
      const next = values[f].trim();
      if (next !== initial[f].trim()) p[f] = next;
    }
    return p;
  }, [values, initial]);
  const dirty = Object.keys(patch).length > 0;

  const set = (f: Field) => (v: string) => {
    setValues((cur) => ({ ...cur, [f]: v }));
    setSaveError(null);
    // fix-as-you-type once a field has been flagged
    if (errors[f]) setErrors((e) => ({ ...e, [f]: validateField(f, v) }));
  };
  const blur = (f: Field) => () => {
    const err = validateField(f, values[f]);
    setErrors((e) => (e[f] === err ? e : { ...e, [f]: err }));
  };

  const leave = () => {
    if (saving) return;
    if (dirty) setConfirmDiscard(true);
    else onDone();
  };

  // Android back: ask before throwing edits away
  const leaveRef = useRef(leave);
  leaveRef.current = leave;
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      leaveRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  const save = async () => {
    const all: Errors = {};
    for (const f of FIELDS) {
      const err = validateField(f, values[f]);
      if (err) all[f] = err;
    }
    setErrors(all);
    const first = FIELDS.find((f) => all[f]);
    if (first) {
      refs[first].current?.focus();
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      if (Platform.OS === "ios") announce(all[first]!);
      return;
    }
    if (!dirty) {
      onDone();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(patch);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      announce("Company profile saved");
      onDone();
    } catch (e) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (isApiError(e, 400) && Object.keys(e.fieldErrors).length) {
        const fe = e.fieldErrors;
        const mapped: Errors = {};
        for (const f of FIELDS) if (fe[f]) mapped[f] = fe[f];
        setErrors(mapped);
        const firstBad = FIELDS.find((f) => mapped[f]);
        if (firstBad) refs[firstBad].current?.focus();
        else setSaveError(e.message);
      } else if (isApiError(e, 403)) {
        setSaveError("Only a company owner can edit the company profile.");
      } else {
        setSaveError(errorMessage(e, "Couldn't save the company profile."));
      }
    } finally {
      setSaving(false);
    }
  };

  const field = (
    f: Field,
    label: string,
    icon: FeatherName,
    extra: Partial<React.ComponentProps<typeof TextField>> = {},
    next?: Field,
  ) => (
    <TextField
      label={label}
      icon={icon}
      value={values[f]}
      onChangeText={set(f)}
      onBlur={blur(f)}
      error={errors[f]}
      inputRef={refs[f]}
      maxLength={MAX[f] + 20}
      optional={f !== "name"}
      returnKeyType={next ? "next" : "done"}
      onSubmitEditing={next ? () => refs[next].current?.focus() : save}
      submitBehavior={next ? "submit" : "blurAndSubmit"}
      {...extra}
    />
  );

  return (
    <Ground>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.top}>
            <BackHeader
              icon="x"
              backLabel={dirty ? "Close, you have unsaved changes" : "Close"}
              onBack={leave}
              title="Edit company"
              subtitle={company.name}
            />
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {saveError ? (
              <View style={styles.alert} accessibilityRole="alert">
                <Feather name="alert-circle" size={16} color={theme.colors.danger} />
                <Text style={styles.alertText}>{saveError}</Text>
              </View>
            ) : null}

            <SectionLabel style={styles.label}>Company</SectionLabel>
            <GlassCard style={styles.card}>
              {field("name", "Display name", "briefcase", { autoCapitalize: "words", hint: "Shown in the app and on reports." }, "legalName")}
              {field("legalName", "Legal name", "file-text", { autoCapitalize: "words", hint: "As registered, for invoices." }, "taxId")}
              {field("taxId", "Tax ID", "hash", { autoCapitalize: "characters", autoCorrect: false }, "address")}
              {field(
                "address",
                "Address",
                "map-pin",
                { autoComplete: "street-address", textContentType: "fullStreetAddress" },
                "phone",
              )}
            </GlassCard>

            <SectionLabel style={styles.label}>Contact</SectionLabel>
            <GlassCard style={styles.card}>
              {field(
                "phone",
                "Phone",
                "phone",
                { keyboardType: "phone-pad", autoComplete: "tel", textContentType: "telephoneNumber", placeholder: "+374 10 000 000" },
                "email",
              )}
              {field(
                "email",
                "Email",
                "mail",
                {
                  keyboardType: "email-address",
                  autoCapitalize: "none",
                  autoCorrect: false,
                  autoComplete: "email",
                  textContentType: "emailAddress",
                  placeholder: "office@example.am",
                },
                "website",
              )}
              {field("website", "Website", "globe", {
                keyboardType: "url",
                autoCapitalize: "none",
                autoCorrect: false,
                textContentType: "URL",
                placeholder: "example.am",
                hint: "https:// is added for you.",
              })}
            </GlassCard>
            <Text style={styles.foot}>Clear a field to remove it. Changes show for every member right away.</Text>
          </ScrollView>

          <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
            <Button title="Cancel" variant="white" onPress={leave} disabled={saving} style={styles.half} />
            <Button
              title={dirty ? "Save" : "Saved"}
              icon={dirty ? "check" : undefined}
              onPress={save}
              loading={saving}
              disabled={!dirty}
              style={styles.half}
              label={dirty ? "Save company profile" : "No changes to save"}
            />
          </View>
        </KeyboardAvoidingView>

        <Sheet
          visible={confirmDiscard}
          onClose={() => setConfirmDiscard(false)}
          tone="danger"
          icon="trash-2"
          title="Discard your changes?"
          body="The company profile stays as it was."
          actions={
            <>
              <Button
                title="Discard changes"
                variant="danger"
                onPress={() => {
                  setConfirmDiscard(false);
                  onDone();
                }}
              />
              <Button title="Keep editing" variant="ghost" onPress={() => setConfirmDiscard(false)} />
            </>
          }
        />
      </SafeAreaView>
    </Ground>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: theme.spacing.gutter, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.sm },
  content: { paddingHorizontal: theme.spacing.gutter, paddingBottom: theme.spacing.xxl, gap: theme.spacing.md },
  label: { marginTop: theme.spacing.sm, marginLeft: theme.spacing.xs },
  card: { gap: theme.spacing.lg },
  foot: {
    fontFamily: theme.fonts.body,
    fontSize: theme.type.small,
    lineHeight: theme.type.small * 1.45,
    color: theme.colors.muted,
    marginHorizontal: theme.spacing.xs,
  },
  alert: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: theme.radius.btn,
    padding: theme.spacing.md,
  },
  alertText: { flex: 1, fontFamily: theme.fonts.bodyMedium, fontSize: theme.type.small + 1, color: theme.colors.danger },
  bar: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.gutter,
    paddingTop: theme.spacing.md,
    backgroundColor: theme.colors.groundDeep,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.hairline,
  },
  half: { flex: 1, paddingHorizontal: theme.spacing.md },
});
