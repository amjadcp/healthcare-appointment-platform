import apiClient from '../client';
import type { Doctor, Availability, SlotResponse } from '../../types';

interface ProvisionPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  department: string;
  degrees: string;
}

export const doctorService = {
  getAll: (orgSlug?: string) =>
    apiClient.get<Doctor[]>('/api/v1/doctors', {
      params: orgSlug ? { orgSlug } : undefined,
    }),

  provision: (payload: ProvisionPayload) =>
    apiClient.post<Doctor>('/api/v1/doctors', payload),

  getAvailability: (doctorId: string) =>
    apiClient.get<Availability[]>(`/api/v1/doctors/${doctorId}/availability`),

  updateAvailability: (doctorId: string, payload: Omit<Availability, 'enabled'>[]) =>
    apiClient.put<void>(`/api/v1/doctors/${doctorId}/availability`, payload),

  getSlots: (doctorId: string, date: string) =>
    apiClient.get<SlotResponse[]>('/api/v1/slots/available', {
      params: { doctorId, date },
    }),
};
