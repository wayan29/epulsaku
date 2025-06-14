// src/contexts/AuthContext.tsx
"use client";

import type { ReactNode } from "react";
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { deleteSessionByToken } from '@/lib/user-utils'; // Server action

export interface User {
  id: string;
  username: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null; // Added token state
  isLoading: boolean;
  login: (userData: User, sessionToken: string) => void; // Takes User object and token
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'ePulsakuAuthSession_v2'; // Updated key for new structure

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null); // Added token state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedAuth) {
      try {
        const authData = JSON.parse(storedAuth);
        if (authData && authData.user && authData.token) {
            setUser(authData.user);
            setToken(authData.token);
            setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Failed to parse auth session from localStorage", error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userData: User, sessionToken: string) => {
    setUser(userData);
    setToken(sessionToken);
    setIsAuthenticated(true);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: userData, token: sessionToken }));
  };

  const logout = useCallback(async () => { // Made logout async
    const currentToken = localStorage.getItem(AUTH_STORAGE_KEY) ? JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)!).token : null;
    
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);

    if (currentToken) {
      try {
        await deleteSessionByToken(currentToken); // Call server action to delete session from DB
      } catch (error) {
        console.error("Failed to delete session from DB on logout:", error);
        // Non-critical, proceed with client-side logout
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
