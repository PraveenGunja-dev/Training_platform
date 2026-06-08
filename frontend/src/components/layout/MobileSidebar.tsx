import { NavLink } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import type { NavItem } from './navConfigs';

function MobileNavLink({ to, label, icon: Icon, onClick }: NavItem & { onClick: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group ${
          isActive
            ? 'bg-sky-500/15 text-sky-300'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 transition-all duration-150 ${
              isActive
                ? 'bg-sky-500/20 text-sky-300'
                : 'text-slate-500 group-hover:text-slate-300 group-hover:bg-white/8'
            }`}
          >
            <Icon className="h-[15px] w-[15px]" />
          </span>
          <span className="truncate leading-none">{label}</span>
          {isActive && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />
          )}
        </>
      )}
    </NavLink>
  );
}

function groupBySection(items: NavItem[]) {
  const sections: { title: string | null; items: NavItem[] }[] = [];
  let current: { title: string | null; items: NavItem[] } | null = null;
  for (const item of items) {
    if (item.section !== undefined || current === null) {
      current = { title: item.section ?? null, items: [] };
      sections.push(current);
    }
    current.items.push(item);
  }
  return sections;
}

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
}

export function MobileSidebar({ open, onClose, navItems }: MobileSidebarProps) {
  const sections = groupBySection(navItems);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="left"
        className="p-0 border-r-0 w-64 flex flex-col"
        style={{ background: 'linear-gradient(160deg, #001f4d 0%, #00285A 60%, #001635 100%)' }}
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>

        {/* ── Nav items ──────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5 scrollbar-none" aria-label="Mobile navigation">
          {sections.map((section, i) => (
            <div key={i}>
              {section.title && (
                <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 select-none">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(item => (
                  <MobileNavLink key={item.to} {...item} onClick={onClose} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div
          className="px-4 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-slate-600 text-[11px] text-center">AGEL · ACLP Portal</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
