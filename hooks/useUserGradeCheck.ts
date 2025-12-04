'use client';

import { useState, useEffect } from 'react';
import { authRepository, type User } from '@/repositories/auth.repository';

export function useUserGradeCheck() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsUpdate, setNeedsUpdate] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await authRepository.getMe();
        if (data.user) {
          setUser(data.user);
          // Check if user needs to update grade info
          // User needs update if gradeId is null or undefined
          setNeedsUpdate(!data.user.gradeId);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const refreshUser = async () => {
    try {
      const data = await authRepository.getMe();
      if (data.user) {
        setUser(data.user);
        setNeedsUpdate(!data.user.gradeId);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return {
    user,
    loading,
    needsUpdate,
    refreshUser,
  };
}

