import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "./firebase";

interface AuthState {
  user: User | null;
  cargando: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, cargando: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<AuthState>({ user: null, cargando: true });

  useEffect(
    () => onAuthStateChanged(auth, (user) => setEstado({ user, cargando: false })),
    []
  );

  return <AuthContext.Provider value={estado}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
