import React, { useState } from 'react';
import { AdminSidebar, AdminModuleId, ADMIN_NAV_ITEMS } from './AdminSidebar.tsx';
import { AdminHeader, AdminSessionInfo } from './AdminHeader.tsx';

interface AdminLayoutProps {
  session: AdminSessionInfo;
  activeModule: AdminModuleId;
  onSelectModule: (id: AdminModuleId) => void;
  globalSearch: string;
  onGlobalSearchChange: (val: string) => void;
  notifications: { id: string; title: string; detail: string; time: string }[];
  onLogout: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  session,
  activeModule,
  onSelectModule,
  globalSearch,
  onGlobalSearchChange,
  notifications,
  onLogout,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeNav = ADMIN_NAV_ITEMS.find(n => n.id === activeModule);

  return (
    <div dir="ltr" className="min-h-screen flex bg-gray-100 text-gray-900 font-sans-en">
      <AdminSidebar
        activeModule={activeModule}
        permissions={session.permissions || []}
        role={session.role || 'Read-only Analyst'}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onSelectModule={onSelectModule}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <AdminHeader
          session={session}
          activeModuleLabel={activeNav?.label || 'Admin OS'}
          globalSearch={globalSearch}
          onGlobalSearchChange={onGlobalSearchChange}
          notifications={notifications}
          onToggleMobileNav={() => setMobileOpen(!mobileOpen)}
          onLogout={onLogout}
        />

        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
