import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/auth';

export function useSetPassword() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);

  return useMutation({
    mutationFn: (data: { token: string; password: string }) => authApi.setPassword(data),
    onSuccess: (res) => {
      setAuth(res.data.user, res.data.access);
      toast.success('Password set! Welcome.');
      navigate('/', { replace: true });
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { errors?: Array<{ message: string }> } } };
      toast.error(apiErr.response?.data?.errors?.[0]?.message ?? 'Failed to set password');
    },
  });
}
