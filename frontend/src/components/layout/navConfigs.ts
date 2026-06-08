import {
  LayoutDashboard,
  Users,
  User,
  FolderKanban,
  CalendarDays,
  CalendarRange,
  ListChecks,
  ClipboardCheck,
  Upload,
  FileText,
  Settings,
  ScrollText,
  Bell,
  CheckSquare,
  Network,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  section?: string; // marks the start of a new section with this label
}

export const adminNav: NavItem[] = [
  { to: '/admin/dashboard',     label: 'Dashboard',     icon: LayoutDashboard, section: 'Overview'  },
  { to: '/admin/users',         label: 'Users',          icon: Users,           section: 'People'    },
  { to: '/admin/groups',        label: 'Class Groups',   icon: FolderKanban                          },
  { to: '/admin/classes',       label: 'Classes',        icon: CalendarDays,    section: 'Training'  },
  { to: '/admin/calendar',      label: 'Calendar',       icon: CalendarRange                         },
  { to: '/admin/assignments',   label: 'Assignments',    icon: ListChecks                            },
  { to: '/admin/attendance',    label: 'Attendance',     icon: CheckSquare                           },
  { to: '/admin/shared-uploads',label: 'Shared Uploads', icon: Upload,          section: 'Content'   },
  { to: '/admin/documents',     label: 'Documents',      icon: FileText                              },
  { to: '/admin/org-chart',     label: 'Org Chart',      icon: Network,         section: 'System'    },
  { to: '/admin/audit',         label: 'Audit Log',      icon: ScrollText                            },
  { to: '/admin/settings',      label: 'Settings',       icon: Settings                              },
];

export const participantNav: NavItem[] = [
  { to: '/me/dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/me/calendar',      label: 'Calendar',        icon: CalendarDays    },
  { to: '/me/tasks',         label: 'My Tasks',        icon: ListChecks      },
  { to: '/me/submissions',   label: 'My Submissions',  icon: Upload          },
  { to: '/me/documents',     label: 'Documents',       icon: FileText        },
  { to: '/me/notifications', label: 'Notifications',   icon: Bell            },
];

export const instructorNav: NavItem[] = [
  { to: '/instructor/dashboard',      label: 'Dashboard',     icon: LayoutDashboard, section: 'Overview'  },
  { to: '/instructor/calendar',       label: 'Calendar',      icon: CalendarRange                         },
  { to: '/instructor/groups',         label: 'Groups',        icon: FolderKanban,    section: 'Teaching'  },
  { to: '/instructor/classes',        label: 'Classes',       icon: CalendarDays                          },
  { to: '/instructor/attendance',     label: 'Attendance',    icon: CheckSquare                           },
  { to: '/instructor/assignments',    label: 'Assignments',   icon: ListChecks,      section: 'Content'   },
  { to: '/instructor/submissions',    label: 'Submissions',   icon: ClipboardCheck                        },
  { to: '/instructor/documents',      label: 'Documents',     icon: FileText                              },
  { to: '/instructor/shared-uploads', label: 'Shared Uploads',icon: Upload                                },
  { to: '/instructor/notifications',  label: 'Notifications', icon: Bell,            section: 'Account'   },
  { to: '/instructor/profile',        label: 'Profile',       icon: User                                  },
];
