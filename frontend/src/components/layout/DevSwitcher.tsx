import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { useQueryClient } from '@tanstack/react-query';
import { router } from '@/router';
import { simulateStartAttendance, simulateEndAttendance } from '@/mocks/data/attendance';
import type { Role } from '@/lib/types';

export function DevSwitcher() {
  const [hidden, setHidden] = useState(false);
  const user = useAuthStore((s) => s.user);
  const mockLogin = useAuthStore((s) => s.mockLogin);
  const logout = useAuthStore((s) => s.logout);
  const qc = useQueryClient();

  if (!import.meta.env.DEV) return null;
  if (hidden) return (
    <button
      onClick={() => setHidden(false)}
      className="fixed bottom-4 right-4 z-50 rounded-full bg-amber-100 border border-amber-300 w-8 h-8 text-amber-900 shadow-lg text-xs font-bold"
      title="Show Dev Tools"
    >⚠️</button>
  );

  const handleLogin = (role: Role) => {
    mockLogin(role);
    void router.navigate('/');
  };

  const handleLogout = () => {
    logout();
    void router.navigate('/login');
  };

  const handleSimStart = () => {
    try {
      simulateStartAttendance('c-safety-a-2');
      qc.invalidateQueries({ queryKey: ['attendance', 'active-session'] });
      qc.invalidateQueries({ queryKey: ['admin', 'attendance', 'sessions'] });
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  };

  const handleSimEnd = () => {
    simulateEndAttendance();
    qc.invalidateQueries({ queryKey: ['attendance', 'active-session'] });
    qc.invalidateQueries({ queryKey: ['admin', 'attendance', 'sessions'] });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-amber-100 border border-amber-300 p-3 shadow-lg text-xs max-w-[240px]">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-amber-900">⚠️ Dev Tools</div>
        <button onClick={() => setHidden(true)} className="text-amber-700 hover:text-amber-900 font-bold leading-none" title="Hide">✕</button>
      </div>
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => handleLogin('ADMIN')}
          className="px-2 py-1 rounded bg-card border border-amber-200 hover:bg-amber-50"
        >
          Admin
        </button>
        <button
          onClick={() => handleLogin('INSTRUCTOR')}
          className="px-2 py-1 rounded bg-card border border-amber-200 hover:bg-amber-50"
        >
          Instructor
        </button>
        <button
          onClick={() => handleLogin('PARTICIPANT')}
          className="px-2 py-1 rounded bg-card border border-amber-200 hover:bg-amber-50"
        >
          Participant
        </button>
        {user && (
          <button
            onClick={handleLogout}
            className="px-2 py-1 rounded bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100"
          >
            Logout
          </button>
        )}
      </div>
      <div className="mt-2 flex gap-1 flex-wrap border-t border-amber-200 pt-2">
        <button
          onClick={handleSimStart}
          className="px-2 py-1 rounded bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100"
        >
          Sim: Start Att.
        </button>
        <button
          onClick={handleSimEnd}
          className="px-2 py-1 rounded bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100"
        >
          Sim: End Att.
        </button>
      </div>
      {user && (
        <div className="mt-2 text-amber-700">
          Logged in: <span className="font-medium">{user.full_name}</span> ({user.role})
        </div>
      )}
    </div>
  );
}
