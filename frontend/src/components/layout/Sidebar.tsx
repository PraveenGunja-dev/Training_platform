import { NavLink } from 'react-router-dom';
import type { NavItem } from './navConfigs';

function SidebarLink({ to, label, icon: Icon }: NavItem) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group overflow-hidden ${
          isActive
            ? 'text-white'
            : 'text-slate-400 hover:text-slate-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Active background gradient pill */}
          {isActive && (
            <span
              className="absolute inset-0 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(0,82,165,0.55) 0%, rgba(227,24,55,0.30) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
            />
          )}

          {/* Left accent bar */}
          {isActive && (
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
              style={{ background: 'linear-gradient(180deg, #5B9FE8 0%, #E31837 100%)' }}
            />
          )}

          {/* Hover bg */}
          {!isActive && (
            <span className="absolute inset-0 rounded-xl bg-white/0 group-hover:bg-white/[0.05] transition-colors duration-200" />
          )}

          {/* Icon box */}
          <span
            className={`relative flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 transition-all duration-200 ${
              isActive
                ? 'text-white'
                : 'text-slate-500 group-hover:text-slate-300'
            }`}
            style={
              isActive
                ? {
                    background: 'linear-gradient(135deg, rgba(91,159,232,0.35) 0%, rgba(227,24,55,0.20) 100%)',
                    boxShadow: '0 1px 4px rgba(0,82,165,0.3)',
                  }
                : undefined
            }
          >
            <Icon className="h-[15px] w-[15px]" />
          </span>

          <span className="relative truncate leading-none">{label}</span>

          {/* Active glow dot */}
          {isActive && (
            <span
              className="relative ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #5B9FE8, #E31837)', boxShadow: '0 0 6px rgba(91,159,232,0.8)' }}
            />
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

interface SidebarProps {
  navItems: NavItem[];
}

export function Sidebar({ navItems }: SidebarProps) {
  const sections = groupBySection(navItems);

  return (
    <nav
      className="hidden md:flex w-64 flex-col shrink-0 min-h-full"
      style={{ background: 'linear-gradient(160deg, #001f4d 0%, #00285A 50%, #001635 100%)' }}
      aria-label="Main navigation"
    >
      {/* ── Nav items ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-5 scrollbar-none">
        {sections.map((section, i) => (
          <div key={i}>
            {section.title && (
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 select-none">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => (
                <SidebarLink key={item.to} {...item} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div
        className="px-4 py-3 flex-shrink-0 flex items-center justify-center gap-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #5B9FE8, #E31837)' }}
        />
        <p className="text-slate-500 text-[11px] tracking-wide">AGEL · ACLP Portal</p>
      </div>
    </nav>
  );
}
