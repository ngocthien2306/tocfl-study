import { useState, useCallback } from "react";
import { authApi, progressApi, type AuthResponse } from "../api/client";

const TOKEN_KEY   = "tocfl_token";
const USER_KEY    = "tocfl_user";

export interface AuthUser {
  user_id: number;
  name:    string;
  email:   string;
}

export interface AuthState {
  token:   string | null;
  user:    AuthUser | null;
  loading: boolean;
  error:   string | null;
}

export function useAuth() {
  const [token,   setToken  ] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user,    setUser   ] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) as AuthUser : null;
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState<string | null>(null);

  function _saveAuth(res: AuthResponse) {
    const u: AuthUser = { user_id: res.user_id, name: res.name, email: res.email };
    localStorage.setItem(TOKEN_KEY, res.access_token);
    localStorage.setItem(USER_KEY,  JSON.stringify(u));
    setToken(res.access_token);
    setUser(u);
  }

  const register = useCallback(async (
    email: string,
    name: string,
    password: string,
    localProgress?: { words: Record<string, boolean>; reading: Record<string, boolean> },
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.register(email, name, password);
      _saveAuth(res);
      // Sync localStorage progress ngay sau khi đăng ký
      if (localProgress) {
        await progressApi.sync(res.access_token, localProgress).catch(() => {});
      }
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Đăng ký thất bại");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (
    email: string,
    password: string,
    localProgress?: { words: Record<string, boolean>; reading: Record<string, boolean> },
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login(email, password);
      _saveAuth(res);
      // Sync localStorage progress lên server sau khi login
      if (localProgress) {
        await progressApi.sync(res.access_token, localProgress).catch(() => {});
      }
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Đăng nhập thất bại");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    token,
    user,
    loading,
    error,
    isLoggedIn: !!token && !!user,
    register,
    login,
    logout,
    clearError,
  };
}
