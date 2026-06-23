import apiClient from '../client';
import type { AppointmentEvent, PaginatedResponse } from '../../types';

export const eventService = {
  getAll: (page = 0, size = 10) =>
    apiClient.get<PaginatedResponse<AppointmentEvent>>('/api/v1/events', {
      params: { page, size },
    }),
};
