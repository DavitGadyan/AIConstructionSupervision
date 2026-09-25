import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  api,
  isApiError,
  type Company,
  type CompanyPatch,
  type OrgRole,
  type ProjectSummary,
  type User,
  type UserRole,
} from "./api";
import { getItem, KEYS, removeItem, setItem } from "./storage";

interface SessionState {
  ready: boolean;
  onboarded: boolean;
  token: string | null;
  user: User | null;
  projectId: string | null;
  project: ProjectSummary | null;
  projects: ProjectSummary[] | null;
  /** The caller's company (GET /api/company); null until loaded or when signed out. */
  company: Company | null;
  companyLoading: boolean;
  companyError: string | null;
}

interface SessionApi extends SessionState {
  /** The user's role in their org. From login (v1.1) or, for older stored sessions, from company.members. */
  role: UserRole | null;
  /** The org kind (developer, lender, authority, ...). */
  orgRole: OrgRole | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  finishOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  loadProjects: () => Promise<ProjectSummary[]>;
  selectProject: (p: ProjectSummary) => Promise<void>;
  /** Refetch the company profile (and with it the roles). */
  refreshCompany: () => Promise<Company | null>;
  /** PATCH /api/company (owner only; throws ApiError 403 otherwise) and keep the result. */
  updateCompany: (patch: CompanyPatch) => Promise<Company>;
  /** The server rejected the token (401): drop the session so the auth gate shows login. */
  expireSession: () => Promise<void>;
}

const SessionContext = createContext<SessionApi | null>(null);

/** Fill role / org.role on a user stored before v1.1 from the company profile. */
function withRoles(user: User, company: Company): User {
  const role = user.role ?? company.members.find((m) => m.id === user.id || m.email === user.email)?.role;
  const orgRole = user.org.role ?? company.role;
  if (role === user.role && orgRole === user.org.role) return user;
  return { ...user, role, org: { ...user.org, role: orgRole } };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    ready: false,
    onboarded: false,
    token: null,
    user: null,
    projectId: null,
    project: null,
    projects: null,
    company: null,
    companyLoading: false,
    companyError: null,
  });
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = state.token;
  const userRef = useRef<User | null>(null);
  userRef.current = state.user;

  const clearAuth = useCallback(async () => {
    await Promise.all([removeItem(KEYS.token), removeItem(KEYS.user), removeItem(KEYS.project)]);
    setState((s) => ({
      ...s,
      token: null,
      user: null,
      projectId: null,
      project: null,
      projects: null,
      company: null,
      companyLoading: false,
      companyError: null,
    }));
  }, []);

  const loadCompany = useCallback(
    async (token: string, knownUser?: User | null): Promise<Company | null> => {
      setState((s) => ({ ...s, companyLoading: true }));
      try {
        const company = await api.company(token);
        if (tokenRef.current !== token) return null; // signed out / switched meanwhile
        const before = userRef.current ?? knownUser ?? null;
        const upgraded = before ? withRoles(before, company) : null;
        setState((s) => ({
          ...s,
          company,
          user: s.user ? withRoles(s.user, company) : s.user,
          companyLoading: false,
          companyError: null,
        }));
        // persist so the next cold start has the roles before the network answers
        if (upgraded && upgraded !== before) await setItem(KEYS.user, JSON.stringify(upgraded)).catch(() => {});
        return company;
      } catch (e) {
        if (tokenRef.current !== token) return null;
        if (isApiError(e, 401)) {
          // the stored token expired or was revoked: back to login
          await clearAuth();
          return null;
        }
        setState((s) => ({
          ...s,
          companyLoading: false,
          companyError: e instanceof Error ? e.message : String(e),
        }));
        return null;
      }
    },
    [clearAuth],
  );

  useEffect(() => {
    (async () => {
      const [token, userRaw, projectRaw, onboarded] = await Promise.all([
        getItem(KEYS.token),
        getItem(KEYS.user),
        getItem(KEYS.project),
        getItem(KEYS.onboarded),
      ]);
      let user: User | null = null;
      let project: ProjectSummary | null = null;
      try {
        user = userRaw ? JSON.parse(userRaw) : null;
        project = projectRaw ? JSON.parse(projectRaw) : null;
      } catch {
        // corrupted cache: fall through to signed-out defaults
      }
      // a stored user without the nested org (very old cache) is unusable
      if (user && (!user.org || typeof user.org !== "object")) user = null;
      tokenRef.current = token;
      setState((s) => ({
        ...s,
        ready: true,
        onboarded: onboarded === "1",
        token,
        user,
        project: token ? project : null,
        projectId: token && project ? project.id : null,
      }));
      if (token) loadCompany(token, user);
    })();
  }, [loadCompany]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { token, user } = await api.login(email.trim(), password);
      await setItem(KEYS.token, token);
      await setItem(KEYS.user, JSON.stringify(user));
      tokenRef.current = token;
      setState((s) => ({
        ...s,
        token,
        user,
        projectId: null,
        project: null,
        projects: null,
        company: null,
        companyError: null,
      }));
      loadCompany(token, user);
    },
    [loadCompany],
  );

  const signOut = useCallback(async () => {
    const token = state.token;
    if (token) api.logout(token).catch(() => {});
    tokenRef.current = null;
    await clearAuth();
  }, [state.token, clearAuth]);

  const finishOnboarding = useCallback(async () => {
    await setItem(KEYS.onboarded, "1");
    setState((s) => ({ ...s, onboarded: true }));
  }, []);

  const resetOnboarding = useCallback(async () => {
    await removeItem(KEYS.onboarded);
    setState((s) => ({ ...s, onboarded: false }));
  }, []);

  const loadProjects = useCallback(async () => {
    if (!state.token) return [];
    const projects = await api.projects(state.token);
    // keep the selected project's cached summary fresh (v1.1 adds shared/access)
    const current = state.projectId ? projects.find((p) => p.id === state.projectId) : undefined;
    if (current) await setItem(KEYS.project, JSON.stringify(current)).catch(() => {});
    setState((s) => ({ ...s, projects, project: current && s.projectId === current.id ? current : s.project }));
    return projects;
  }, [state.token, state.projectId]);

  const selectProject = useCallback(async (p: ProjectSummary) => {
    await setItem(KEYS.project, JSON.stringify(p));
    setState((s) => ({ ...s, projectId: p.id, project: p }));
  }, []);

  const refreshCompany = useCallback(async () => {
    if (!state.token) return null;
    return loadCompany(state.token);
  }, [state.token, loadCompany]);

  const updateCompany = useCallback(
    async (patch: CompanyPatch) => {
      if (!state.token) throw new Error("Not signed in");
      const company = await api.updateCompany(state.token, patch);
      setState((s) => ({
        ...s,
        company,
        // the org name shows in the header/account rows: keep the cached user in step
        user: s.user ? { ...withRoles(s.user, company), org: { ...s.user.org, name: company.name, role: company.role } } : s.user,
      }));
      return company;
    },
    [state.token],
  );

  const expireSession = useCallback(async () => {
    if (!tokenRef.current) return;
    tokenRef.current = null;
    await clearAuth();
  }, [clearAuth]);

  const role: UserRole | null =
    state.user?.role ??
    state.company?.members.find((m) => m.id === state.user?.id || m.email === state.user?.email)?.role ??
    null;
  const orgRole: OrgRole | null = state.user?.org?.role ?? state.company?.role ?? null;

  const value = useMemo<SessionApi>(
    () => ({
      ...state,
      role,
      orgRole,
      signIn,
      signOut,
      finishOnboarding,
      resetOnboarding,
      loadProjects,
      selectProject,
      refreshCompany,
      updateCompany,
      expireSession,
    }),
    [
      state,
      role,
      orgRole,
      signIn,
      signOut,
      finishOnboarding,
      resetOnboarding,
      loadProjects,
      selectProject,
      refreshCompany,
      updateCompany,
      expireSession,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession outside SessionProvider");
  return ctx;
}

/** Like useSession but returns null outside the provider (for providers that may be mounted either way). */
export function useSessionMaybe() {
  return useContext(SessionContext);
}

/** For screens behind the auth gate: token and project are guaranteed. */
export function useAuthed() {
  const s = useSession();
  return { ...s, token: s.token ?? "", projectId: s.projectId ?? "" };
}
