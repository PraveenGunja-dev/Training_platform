import { useState } from 'react';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { usersApi } from '@/api/users';
import { Button } from '@/components/ui/button';

interface ResendInviteButtonProps {
  userId: string;
  email: string;
}

export function ResendInviteButton({ userId, email }: ResendInviteButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    setLoading(true);
    try {
      await usersApi.resendInvite(userId);
      toast.success(`Invite resent to ${email}`);
    } catch {
      toast.error('Failed to resend invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={loading}
      onClick={handleResend}
      title="Resend invite email"
    >
      <Mail className="h-3.5 w-3.5" />
    </Button>
  );
}
