import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <header
      className="sticky top-0 z-40 flex h-16 items-center justify-between border-b px-4 sm:px-6 shrink-0"
      style={{
        background: 'linear-gradient(135deg, #deeaf8 0%, #ffffff 55%, #fce8eb 100%)',
        borderBottomColor: '#d0dff0',
        boxShadow: '0 1px 6px rgba(0,40,90,0.08)',
      }}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        {onMenuClick && (
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
        )}
        <Link to="/" aria-label="ACLP Training Management System home" className="flex items-center gap-3">
          <img src="/training/adani-logo.svg" alt="Adani Group" className="h-7 w-auto" draggable={false} />
          <span className="hidden sm:block w-0.5 h-7 rounded-full bg-[#0052A5]/40" aria-hidden="true" />
          <span className="text-[#00285A] text-[13px] font-semibold hidden sm:block leading-tight">
            ACLP Training Management System
          </span>
        </Link>
      </div>
      <div className="flex items-center gap-1">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
