import React from 'react';
import {
  BarChart2,
  FileText,
  Edit3,
  CheckSquare,
  Layers,
  Layout,
  Image as ImageIcon,
  Globe,
  DollarSign,
  Mail,
  Zap,
  Sparkles,
  Users,
  Sliders,
  KeyRound,
  Activity,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AdminPermission } from '../../types/index.ts';

export type AdminModuleId =
  | 'overview'
  | 'reports'
  | 'articles'
  | 'composer'
  | 'workflow'
  | 'categories'
  | 'homepage'
  | 'media'
  | 'seo'
  | 'ads'
  | 'audience'
  | 'automation'
  | 'ai-studio'
  | 'ai-keys'
  | 'users'
  | 'settings'
  | 'health';

export interface AdminNavItem {
  id: AdminModuleId;
  label: string;
  section: string;
  permission: AdminPermission;
  icon: React.ComponentType<{ className?: string }>;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: 'overview', label: 'Overview', section: 'Core', permission: 'overview:view', icon: BarChart2 },
  { id: 'reports', label: 'Reports Center', section: 'Core', permission: 'reports:view', icon: FileText },

  { id: 'articles', label: 'Articles Library', section: 'Editorial', permission: 'articles:read', icon: FileText },
  { id: 'composer', label: 'News Composer', section: 'Editorial', permission: 'articles:write', icon: Edit3 },
  { id: 'workflow', label: 'Editorial Workflow', section: 'Editorial', permission: 'articles:publish', icon: CheckSquare },
  { id: 'media', label: 'Media Library', section: 'Editorial', permission: 'media:manage', icon: ImageIcon },

  { id: 'homepage', label: 'Homepage Builder', section: 'Pages & Layout', permission: 'homepage:manage', icon: Layout },
  { id: 'categories', label: 'Category Pages', section: 'Pages & Layout', permission: 'categories:manage', icon: Layers },

  { id: 'seo', label: 'SEO & Search Console', section: 'Growth & Revenue', permission: 'seo:manage', icon: Globe },
  { id: 'ads', label: 'Advertising & Slots', section: 'Growth & Revenue', permission: 'ads:manage', icon: DollarSign },
  { id: 'audience', label: 'Audience & Alerts', section: 'Growth & Revenue', permission: 'audience:manage', icon: Mail },

  { id: 'automation', label: 'Live Data & Cron', section: 'AI & Automation', permission: 'automation:manage', icon: Zap },
  { id: 'ai-studio', label: 'AI Content Studio', section: 'AI & Automation', permission: 'ai:use', icon: Sparkles },
  { id: 'ai-keys', label: 'AI Keys & Routing', section: 'AI & Automation', permission: 'ai:keys', icon: KeyRound },

  { id: 'users', label: 'Staff & RBAC Roles', section: 'System', permission: 'users:manage', icon: Users },
  { id: 'settings', label: 'Global Settings', section: 'System', permission: 'settings:manage', icon: Sliders },
  { id: 'health', label: 'System Health', section: 'System', permission: 'health:view', icon: Activity },
];

interface AdminSidebarProps {
  activeModule: AdminModuleId;
  permissions: string[];
  role: string;
  collapsed: boolean;
  mobileOpen: boolean;
  onSelectModule: (id: AdminModuleId) => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeModule,
  permissions,
  role,
  collapsed,
  mobileOpen,
  onSelectModule,
  onToggleCollapse,
  onCloseMobile,
}) => {
  const isAllowed = (perm: AdminPermission) =>
    role === 'Super Admin' || permissions.includes(perm);

  const visibleItems = ADMIN_NAV_ITEMS.filter(item => isAllowed(item.permission));
  const sections = Array.from(new Set(visibleItems.map(i => i.section)));

  const sidebarBody = (
    <div className="h-full flex flex-col bg-gray-950 text-gray-200 border-r border-gray-800 select-none">
      {/* Brand header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-gray-800 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-white truncate">360Khabarnama</div>
              <div className="text-[10px] text-emerald-400 font-mono">Admin OS v4</div>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:inline-flex p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
        {sections.map(sec => (
          <div key={sec} className="space-y-1">
            {!collapsed && (
              <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                {sec}
              </div>
            )}
            {visibleItems
              .filter(i => i.section === sec)
              .map(item => {
                const Icon = item.icon;
                const active = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectModule(item.id);
                      onCloseMobile();
                    }}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-emerald-700 text-white'
                        : 'text-gray-300 hover:bg-gray-900 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
          </div>
        ))}
      </nav>

      {/* Role footer */}
      {!collapsed && (
        <div className="p-3 border-t border-gray-800 text-[11px] text-gray-400">
          <div className="font-semibold text-gray-200 truncate">{role}</div>
          <div className="font-mono text-[10px] text-gray-500">Server-enforced RBAC</div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className="sticky top-0 h-screen">{sidebarBody}</div>
      </aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 h-full">{sidebarBody}</div>
          <div className="flex-1 bg-black/50" onClick={onCloseMobile} />
        </div>
      )}
    </>
  );
};
