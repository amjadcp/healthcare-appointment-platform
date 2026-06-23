import apiClient from '../client';
import type { Appointment, PaginatedResponse, ReservePayload } from '../../types';

export const appointmentService = {
  getAll: (page = 0, size = 10) =>
    apiClient.get<PaginatedResponse<Appointment>>('/api/v1/appointments', {
      params: { page, size },
    }),

  reserve: (payload: ReservePayload) =>
    apiClient.post<Appointment>('/api/v1/appointments/reserve', payload),

  confirmPayment: (id: string) =>
    apiClient.post<Appointment>(`/api/v1/appointments/${id}/confirm-payment`),

  release: (id: string) =>
    apiClient.post<void>(`/api/v1/appointments/${id}/release`),

  cancel: (id: string) =>
    apiClient.delete<void>(`/api/v1/appointments/${id}`),

  complete: (id: string) =>
    apiClient.post<Appointment>(`/api/v1/appointments/${id}/complete`),
};
