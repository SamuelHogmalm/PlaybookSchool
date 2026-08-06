"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  ensureCoachTeam,
  isCoach,
  loadProfileForUser,
  loadTeamForUser,
} from "@/lib/auth";

const AuthContext = createContext({
  user: null,
  profile: null,
  team: null,
  role: "player",
  loading: true,
  configured: false,
  configError: null,
  refreshProfile: async () => {},
  signIn: async () => ({ error: null, profile: null, user: null }),
  signUp: async () => ({ error: null, session: false }),
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [supabase, setSupabase] = useState(null);
  const [configError, setConfigError] = useState(null);
  const configured = isSupabaseConfigured() || !!supabase;

  const hydrate = useCallback(async (client, authUser) => {
    if (!client || !authUser) {
      setProfile(null);
      setTeam(null);
      return { profile: null, team: null };
    }

    let prof = await loadProfileForUser(client, authUser.id);
    let teamRow = await loadTeamForUser(client);

    if (prof?.role === "coach" && !prof.team_id && !teamRow) {
      try {
        await ensureCoachTeam(client, prof.full_name ?? "My Team");
        prof = await loadProfileForUser(client, authUser.id);
        teamRow = await loadTeamForUser(client);
      } catch (e) {
        console.warn("ensureCoachTeam:", e);
      }
    }

    setProfile(prof);
    setTeam(teamRow);
    return { profile: prof, team: teamRow };
  }, []);

  useEffect(() => {
    let mounted = true;

    getSupabaseBrowserClient()
      .then(async (client) => {
        if (!mounted) return;
        setSupabase(client);
        setConfigError(null);

        const { data: { session } } = await client.auth.getSession();
        const u = session?.user ?? null;
        setUser(u);
        if (u) await hydrate(client, u);
        if (mounted) setLoading(false);
      })
      .catch((err) => {
        if (mounted) {
          setConfigError(err.message ?? "Could not connect to Supabase");
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [hydrate]);

  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) await hydrate(supabase, u);
      else {
        setProfile(null);
        setTeam(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, hydrate]);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !user) return null;
    const result = await hydrate(supabase, user);
    return result.profile;
  }, [supabase, user, hydrate]);

  const signIn = useCallback(
    async (email, password) => {
      try {
        const client = supabase ?? (await getSupabaseBrowserClient());
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) return { error, profile: null, user: null };

        const { data: { user: u } } = await client.auth.getUser();
        if (!u) return { error: new Error("No user after sign in"), profile: null, user: null };

        setUser(u);
        const { profile: prof } = await hydrate(client, u);
        return { error: null, profile: prof, user: u };
      } catch (err) {
        return { error: err, profile: null, user: null };
      }
    },
    [supabase, hydrate]
  );

  const signUp = useCallback(
    async ({ email, password, fullName, role, teamName }) => {
      try {
        const client = supabase ?? (await getSupabaseBrowserClient());
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role: role ?? "player" },
            emailRedirectTo: `${window.location.origin}/auth/enter`,
          },
        });
        if (error) return { error, session: false };

        if (data.session && data.user) {
          setUser(data.user);
          await hydrate(client, data.user);
          if (role === "coach") {
            try {
              await ensureCoachTeam(client, teamName || fullName || "My Team");
              await hydrate(client, data.user);
            } catch (e) {
              console.warn("coach team on signup:", e);
            }
          }
          return { error: null, session: true };
        }

        return { error: null, session: false };
      } catch (err) {
        return { error: err, session: false };
      }
    },
    [supabase, hydrate]
  );

  const signOut = useCallback(async () => {
    const client = supabase ?? (await getSupabaseBrowserClient());
    await client.auth.signOut();
    setUser(null);
    setProfile(null);
    setTeam(null);
  }, [supabase]);

  const role = resolveRoleFromState(profile, user);

  const value = useMemo(
    () => ({
      user,
      profile,
      team,
      role,
      loading,
      configured,
      configError,
      refreshProfile,
      signIn,
      signUp,
      signOut,
    }),
    [user, profile, team, role, loading, configured, configError, refreshProfile, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function resolveRoleFromState(profile, user) {
  if (profile?.role === "coach" || profile?.role === "player") return profile.role;
  if (user?.user_metadata?.role === "coach" || user?.user_metadata?.role === "player") {
    return user.user_metadata.role;
  }
  return "player";
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useIsCoach() {
  const { profile, user } = useAuth();
  return isCoach(profile, user);
}
