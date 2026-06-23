import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { ROUTES, USER_ROLES } from '../constants';

/**
 * Redirects already-authenticated users away from public pages (login/register).
 * Call this once at the top of LoginView and RegisterView.
 */
export const useRedirectIfAuthenticated = (): void => {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    navigate(role === USER_ROLES.ADMIN ? ROUTES.ADMIN : ROUTES.DOCTORS, { replace: true });
  }, [isAuthenticated, role, navigate]);
};
