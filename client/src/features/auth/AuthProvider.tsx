import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api/endpoints";
import { ApiError, onUnauthorized } from "@/api/http";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const ME_KEY = ["auth", "me"] as const;

/** Drop every cached query except the session itself (keeps its observer attached). */
const clearData = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  // Any 401 from the API means the session ended: clear cached data and sign out.
  useEffect(
    () =>
      onUnauthorized(() => {
        clearData(queryClient);
        queryClient.setQueryData(ME_KEY, null);
      }),
    [queryClient],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const user = await authApi.login(email, password);
      clearData(queryClient);
      queryClient.setQueryData(ME_KEY, user);
      return user;
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    clearData(queryClient);
    queryClient.setQueryData(ME_KEY, null);
  }, [queryClient]);

  const value = useMemo(
    () => ({ user: me.data ?? null, loading: me.isPending, signIn, signOut }),
    [me.data, me.isPending, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function useCurrentUser() {
  const { user } = useAuth();
  if (!user) throw new Error("useCurrentUser requires a signed-in user");
  return user;
}
