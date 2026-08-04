"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createCoachTeam, fetchMyTeam, syncProfileFromAuth } from "@/lib/teams";

const AuthContext = createContext({
  user: null,
  profile: null,
  team: null,
  loading: true,
  configured: false,
  configError: null,
  refreshProfile: async () => {},
  signIn: async () => ({ error: null, profile: null, user: null }),
  signUp: async () => ({ error: null }),
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

  const loadProfile = useCallback(async (client, userId) => {
    if (!client || !userId) {
      setProfile(null);
      setTeam(null);
      return null;
    }

    let prof = null;

    try {
      prof = await syncProfileFromAuth();
    } catch {
      /* rpc may not exist until migration 2 runs */
    }

    if (!prof) {
      const { data } = await client
        .from("profiles")
        .select("id, full_name, role, position, jersey, team_id")
        .eq("id", userId)
        .maybeSingle();
      prof = data ?? null;
    }

    setProfile(prof);

    try {
      const teamInfo = await fetchMyTeam();
      if (teamInfo?.has_team) {
        setTeam({
          id: teamInfo.team_id,
          name: teamInfo.team_name,
          join_code: teamInfo.join_code,
        });
      } else {
        setTeam(null);
      }
    } catch {
      if (prof?.team_id) {
        const { data: t } = await client
          .from("teams")
          .select("id, name, join_code")
          .eq("id", prof.team_id)
          .maybeSingle();
        setTeam(t ?? null);
      } else {
        setTeam(null);
      }
    }

    if (prof?.role === "coach" && !prof?.team_id) {
      try {
        const created = await createCoachTeam(prof.full_name ?? "My Team");
        setTeam({
          id: created.team_id,
          name: created.team_name,
          join_code: created.join_code,
        });
        prof = await syncProfileFromAuth().catch(() => prof);
        if (prof) setProfile(prof);
      } catch (e) {
        console.warn("createCoachTeam:", e);
      }
    }

    return prof;
  }, []);

  useEffect(() => {
    let mounted = true;

    getSupabaseBrowserClient()
      .then((client) => {
        if (!mounted) return;
        setSupabase(client);
        setConfigError(null);

        return client.auth.getSession().then(async ({ data: { session } }) => {
          if (!mounted) return;
          const u = session?.user ?? null;
          setUser(u);
          if (u) await loadProfile(client, u.id);
          setLoading(false);
        });
      })
      .catch((err) => {
        console.warn("Supabase init:", err);
        if (mounted) {
          setConfigError(err.message ?? "Could not connect to Supabase");
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [loadProfile]);

  useEffect(() => {
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) await loadProfile(supabase, u.id);
      else {
        setProfile(null);
        setTeam(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !user) return null;
    return loadProfile(supabase, user.id);
  }, [supabase, user, loadProfile]);

  const signIn = useCallback(
    async (email, password) => {
      try {
        const client = supabase ?? (await getSupabaseBrowserClient());
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) return { error, profile: null, user: null };
        const { data: { user: u } } = await client.auth.getUser();
        const prof = u ? await loadProfile(client, u.id) : null;
        return { error: null, profile: prof, user: u };
      } catch (err) {
        return { error: err, profile: null, user: null };
      }
    },
    [supabase, loadProfile]
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
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (error) return { error };

        if (data.session && data.user) {
          await loadProfile(client, data.user.id);
          if (role === "coach") {
            try {
              await createCoachTeam(teamName || fullName || "My Team");
              await loadProfile(client, data.user.id);
            } catch (e) {
              console.warn("coach team setup:", e);
            }
          }
        }

        return { error: null };
      } catch (err) {
        return { error: err };
      }
    },
    [supabase, loadProfile]
  );

  const signOut = useCallback(async () => {
    const client = supabase ?? (await getSupabaseBrowserClient());
    await client.auth.signOut();
    setProfile(null);
    setTeam(null);
  }, [supabase]);

  const value = useMemo(
    () => ({
      user,
      profile,
      team,
      loading,
      configured,
      configError,
      refreshProfile,
      signIn,
      signUp,
      signOut,
    }),
    [user, profile, team, loading, configured, configError, refreshProfile, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
