import React, { createContext, useContext, PropsWithChildren } from 'react';
import type { AuthViewModel } from '../Authentication/AuthManager';
import { useAuthViewModel } from '../Authentication/AuthManager';

const AuthContext = createContext<AuthViewModel | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren<{}>) => {
  const authViewModel = useAuthViewModel();

  return (
    <AuthContext.Provider value={authViewModel}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthViewModel => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthContext };
