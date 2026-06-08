import { useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import type { LoginInput } from './schemas';

export function useLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore(s => s.setAuth);

  return useMutation({
    mutationFn: (data: LoginInput) => authApi.login({ ...data, email: data.email.toLowerCase() }),
    onSuccess: (res) => {
      setAuth(res.data.user, res.data.access);
      toast.success('Welcome back!');
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
      // Only honour `from` if it matches the user's role prefix — otherwise
      // a participant who was redirected from /admin/* (or vice-versa) would
      // land on a route their RoleGuard blocks, showing 403.
      const rolePrefix =
        res.data.user.role === 'ADMIN' ? '/admin/' :
        res.data.user.role === 'INSTRUCTOR' ? '/instructor/' :
        '/me/';
      const target = from?.startsWith(rolePrefix) ? from : '/';
      navigate(target, { replace: true });
    },
    // Error is surfaced inline on LoginPage via mutation.error — no toast here.
    onError: () => {},
  });
}
