'use client';

import React, { useState } from 'react';
import { AppSidebar } from '../../components/shell/app-sidebar';
import { AppTopbar } from '../../components/shell/app-topbar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-canvas overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <AppSidebar />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10">
            <AppSidebar />
          </div>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppTopbar onToggleMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-auto bg-canvas relative">
          {children}
        </main>
      </div>
    </div>
  );
}
