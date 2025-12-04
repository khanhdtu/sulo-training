import { get, post } from '@/lib/request';

export interface User {
  id: number;
  username: string;
  name: string;
  displayName?: string | null;
  email?: string | null;
  role: string;
  avatarUrl?: string | null;
  isActive: boolean;
  gradeId?: number | null; // Grade ID in database (foreign key)
  gradeLevel?: number | null; // Grade level (1-12) for display
  level?: number | null; // User learning level
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export const authRepository = {
  /**
   * Get current user
   */
  async getMe(): Promise<{ user: User }> {
    return get<{ user: User }>('/api/auth/me');
  },

  /**
   * Login
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    return post<LoginResponse>('/api/auth/login', data);
  },

  /**
   * Logout
   */
  async logout(): Promise<{ message: string }> {
    return post<{ message: string }>('/api/auth/logout');
  },
};

