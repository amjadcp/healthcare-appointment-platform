export const STORAGE_KEYS = {
  TOKEN: 'medbook_token',
  ROLE: 'medbook_role',
  ORG_NAME: 'medbook_orgName',
  ORG_SLUG: 'medbook_orgSlug',
} as const;

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  ADMIN: '/admin',
  DOCTORS: '/doctors',
  BOOKING: (orgSlug: string) => `/o/${orgSlug}`,
} as const;

export const USER_ROLES = {
  ADMIN: 'ADMIN' as const,
  DOCTOR: 'DOCTOR' as const,
};
