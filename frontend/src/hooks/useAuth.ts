import React, { createContext, useContext, useState, useCallback } from 'react';
import { STORAGE_KEYS } from '../constants';
import type { AuthResponse, UserRole } from '../types';

interface AuthState {
  token: string | null;
  role: UserRole | null;
  orgName: string;
  orgSlug: string;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (data: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const readStorage = (): AuthState => ({
  token: localStorage.getItem(STORAGE_KEYS.TOKEN),
  role: localStorage.getItem(STORAGE_KEYS.ROLE) as UserRole | null,
  orgName: localStorage.getItem(STORAGE_KEYS.ORG_NAME) ?? '',
  orgSlug: localStorage.getItem(STORAGE_KEYS.ORG_SLUG) ?? '',
  isAuthenticated: !!localStorage.getItem(STORAGE_KEYS.TOKEN),
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>(readStorage);

  const login = useCallback((data: AuthResponse) => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
    localStorage.setItem(STORAGE_KEYS.ROLE, data.role);
    localStorage.setItem(STORAGE_KEYS.ORG_NAME, data.orgName ?? '');
    localStorage.setItem(STORAGE_KEYS.ORG_SLUG, data.orgSlug ?? '');
    setAuth({
      token: data.token,
      role: data.role,
      orgName: data.orgName ?? '',
      orgSlug: data.orgSlug ?? '',
      isAuthenticated: true,
    });
  }, []);

  const logout = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    setAuth({ token: null, role: null, orgName: '', orgSlug: '', isAuthenticated: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
};
