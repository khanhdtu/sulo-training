import { patch } from '@/lib/request';

export interface UpdateProfileRequest {
  gradeId: number;
  level?: number;
  displayName?: string | null;
  parentEmail?: string | null;
}

export interface UpdateProfileResponse {
  user: {
    id: number;
    username: string;
    name: string;
    displayName?: string | null;
    email?: string | null;
    role: string;
    gradeId: number | null;
    gradeLevel?: number | null; // Grade level (1-12) for clarity
    level: number | null;
  };
}

export const userRepository = {
  /**
   * Update user profile
   */
  async updateProfile(data: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    return patch<UpdateProfileResponse>('/api/user/update-profile', data);
  },
};

