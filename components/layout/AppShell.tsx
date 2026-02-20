import { ReactNode } from "react";

interface AppShellProps {
  sidebar: ReactNode;
  bottomNav?: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, bottomNav, children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-nesema-bg">
      {/* Desktop sidebar — hidden below lg */}
      <div className="hidden lg:flex lg:flex-shrink-0">{sidebar}</div>

      {/* Main content — full width on mobile, remaining width on desktop */}
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
        {children}
      </main>

      {/* Mobile bottom nav — hidden on lg+ */}
      {bottomNav && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
          {bottomNav}
        </div>
      )}
    </div>
  );
}
