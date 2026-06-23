import apiClient from '../client';
import type { DlqMessage } from '../../types';

export const dlqService = {
  getMessages: (count = 50) =>
    apiClient.get<DlqMessage[]>('/api/v1/events/dlq', { params: { count } }),

  getCount: () =>
    apiClient.get<{ count: number }>('/api/v1/events/dlq/count'),

  reprocess: (eventId?: string) =>
    apiClient.post<void>('/api/v1/events/dlq/reprocess', null, {
      params: eventId ? { eventId } : undefined,
    }),

  dismiss: (eventId?: string) =>
    apiClient.post<void>('/api/v1/events/dlq/dismiss', null, {
      params: eventId ? { eventId } : undefined,
    }),
};
