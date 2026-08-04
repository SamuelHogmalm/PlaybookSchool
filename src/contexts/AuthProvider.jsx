"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  configured: false,
  configError: null,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [supabase, setSupabase] = useState(null);
  const [configError, setConfigError] = useState(null);
  const configured = isSupabaseConfigured() || !!supabase;

  const loadProfile = useCallback(async (client, userId) => {
    if (!client || !userId) {
      setProfile(null);
      return;
    }
    const { data } = await client
      .from("profiles")
      .select("id, full_name, role, position, jersey, team_id")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    getSupabaseBrowserClient()
      .then((client) => {
        if (!mounted) return;
        setSupabase(client);
        setConfigError(null);

        return client.auth.getSession().then(({ data: { session } }) => {
          if (!mounted) return;
          const u = session?.user ?? null;
          setUser(u);
          if (u) loadProfile(client, u.id);
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadProfile(supabase, u.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, [supabase, loadProfile]);

  const signIn = useCallback(
    async (email, password) => {
      try {
        const client = supabase ?? (await getSupabaseBrowserClient());
        const { error } = await client.auth.signInWithPassword({ email, password });
        return { error };
      } catch (err) {
        return { error: err };
      }
    },
    [supabase]
  );

  const signUp = useCallback(
    async ({ email, password, fullName, role }) => {
      try {
        const client = supabase ?? (await getSupabaseBrowserClient());
        const { error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role: role ?? "player" },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        return { error };
      } catch (err) {
        return { error: err };
      }
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    const client = supabase ?? (await getSupabaseBrowserClient());
    await client.auth.signOut();
    setProfile(null);
  }, [supabase]);

  const value = useMemo(
    () => ({ user, profile, loading, configured, configError, signIn, signUp, signOut }),
    [user, profile, loading, configured, configError, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
