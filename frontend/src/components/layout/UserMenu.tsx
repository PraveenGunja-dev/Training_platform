import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Role } from '@/lib/types';

function profilePath(role: Role): string {
  if (role === 'ADMIN') return '/admin/profile';
  if (role === 'INSTRUCTOR') return '/instructor/profile';
  if (role === 'GROUP_ADMIN') return '/group-admin/profile';
  return '/me/profile';
}

export function UserMenu() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);

  const initials = user
    ? user.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?';

  const handleLogout = async () => {
    await authApi.logout();
    queryClient.clear();
    logout();
    navigate('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="User menu"
        >
          <Avatar className="h-8 w-8">
            {user?.photo_url ? (
              <AvatarImage src={user.photo_url} alt={user.full_name} />
            ) : null}
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium">{user?.full_name}</div>
          <div className="text-xs text-muted-foreground">{user?.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => user && navigate(profilePath(user.role))}>
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-rose-600 focus:text-rose-600"
        >
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
