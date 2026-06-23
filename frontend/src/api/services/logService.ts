import apiClient from '../client';
import type { AppointmentLog, PaginatedResponse } from '../../types';

export const logService = {
  getAll: (page = 0, size = 10) =>
    apiClient.get<PaginatedResponse<AppointmentLog>>('/api/v1/logs', {
      params: { page, size },
    }),
};
