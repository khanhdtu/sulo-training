'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useUserGradeCheck } from '@/hooks/useUserGradeCheck';
import type { User } from '@/repositories/auth.repository';

interface UserContextType {
  user: User | null;
  loading: boolean;
  needsUpdate: boolean;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const userData = useUserGradeCheck();

  return (
    <UserContext.Provider value={userData}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}


