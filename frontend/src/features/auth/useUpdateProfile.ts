import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/auth';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore(s => s.setAuth);
  const token = useAuthStore(s => s.accessToken);

  return useMutation({
    mutationFn: (data: { full_name?: string; photo_url?: string }) =>
      authApi.updateProfile(data),
    onSuccess: (res) => {
      setAuth(res.data, token ?? '');
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile updated');
    },
    onError: () => toast.error('Failed to update profile'),
  });
}

export function useUploadPhoto() {
  const setAuth = useAuthStore(s => s.setAuth);
  const token = useAuthStore(s => s.accessToken);

  return useMutation({
    mutationFn: (file: File) => authApi.uploadPhoto(file),
    onSuccess: (res) => {
      setAuth(res.data, token ?? '');
      toast.success('Photo updated');
    },
    onError: () => toast.error('Failed to upload photo'),
  });
}

export function useChangePassword() {
  const setAuth = useAuthStore(s => s.setAuth);
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.accessToken);

  return useMutation({
    mutationFn: (data: { current: string; new_password: string }) =>
      authApi.changePassword(data),
    onSuccess: () => {
      if (user && token) {
        setAuth({ ...user, must_change_password: false }, token);
      }
      toast.success('Password changed successfully');
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { errors?: Array<{ message: string }> } } };
      toast.error(apiErr.response?.data?.errors?.[0]?.message ?? 'Failed to change password');
    },
  });
}

export function useChangeEmail() {
  const setAuth = useAuthStore(s => s.setAuth);
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.accessToken);

  return useMutation({
    mutationFn: (data: { current_email: string; new_email: string; current_password: string }) =>
      authApi.changeEmail(data),
    onSuccess: (res) => {
      if (user && token) {
        setAuth({ ...user, email: res.data.email }, token);
      }
      toast.success('Email updated successfully. Use the new email to log in next time.');
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { errors?: Array<{ message: string }> } } };
      toast.error(apiErr.response?.data?.errors?.[0]?.message ?? 'Failed to update email');
    },
  });
}
