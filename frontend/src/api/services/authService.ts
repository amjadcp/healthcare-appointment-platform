import apiClient from '../client';
import type { AuthResponse } from '../../types';

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  orgName: string;
}

export const authService = {
  login: (payload: LoginPayload) =>
    apiClient.post<AuthResponse>('/api/v1/auth/login', payload),

  register: (payload: RegisterPayload) =>
    apiClient.post<AuthResponse>('/api/v1/auth/register', payload),
};
