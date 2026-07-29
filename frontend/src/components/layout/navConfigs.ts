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
  GraduationCap,
  Layers,
  BarChart2,
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
  { to: '/admin/groups',        label: 'Batches',        icon: FolderKanban                          },
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

export const subMentorNav: NavItem[] = [
  { to: '/sub-mentor/dashboard',      label: 'Dashboard',     icon: LayoutDashboard, section: 'Overview'  },
  { to: '/sub-mentor/calendar',       label: 'Calendar',      icon: CalendarRange                         },
  { to: '/sub-mentor/groups',         label: 'Groups',        icon: FolderKanban,    section: 'Teaching'  },
  { to: '/sub-mentor/classes',        label: 'Classes',       icon: CalendarDays                          },
  { to: '/sub-mentor/attendance',     label: 'Attendance',    icon: CheckSquare                           },
  { to: '/sub-mentor/assignments',    label: 'Assignments',   icon: ListChecks,      section: 'Content'   },
  { to: '/sub-mentor/submissions',    label: 'Submissions',   icon: ClipboardCheck                        },
  { to: '/sub-mentor/documents',      label: 'Documents',     icon: FileText                              },
  { to: '/sub-mentor/shared-uploads', label: 'Shared Uploads',icon: Upload                                },
  { to: '/sub-mentor/notifications',  label: 'Notifications', icon: Bell,            section: 'Account'   },
  { to: '/sub-mentor/profile',        label: 'Profile',       icon: User                                  },
];

export const leadMentorNav: NavItem[] = [
  { to: '/lead-mentor/dashboard',      label: 'Dashboard',     icon: LayoutDashboard, section: 'Overview'  },
  { to: '/lead-mentor/calendar',       label: 'Calendar',      icon: CalendarRange,   section: 'Training'  },
  { to: '/lead-mentor/classes',        label: 'Classes',       icon: CalendarDays                          },
  { to: '/lead-mentor/attendance',     label: 'Attendance',    icon: CheckSquare                           },
  { to: '/lead-mentor/participants',   label: 'Participants',  icon: Users,           section: 'People'    },
  { to: '/lead-mentor/sub-mentors',    label: 'Sub-Mentors',   icon: GraduationCap                         },
  { to: '/lead-mentor/sub-groups',     label: 'Sub-Groups',    icon: Layers                                },
  { to: '/lead-mentor/assignments',    label: 'Assignments',   icon: ListChecks,      section: 'Content'   },
  { to: '/lead-mentor/submissions',    label: 'Submissions',   icon: ClipboardCheck                        },
  { to: '/lead-mentor/documents',      label: 'Documents',     icon: FileText                              },
  { to: '/lead-mentor/shared-uploads', label: 'Shared Uploads',icon: Upload                                },
  { to: '/lead-mentor/analytics',      label: 'Analytics',     icon: BarChart2,       section: 'Reports'   },
  { to: '/lead-mentor/notifications',  label: 'Notifications', icon: Bell,            section: 'Account'   },
  { to: '/lead-mentor/profile',        label: 'Profile',       icon: User                                   },
];
