import { ReactNode } from "react";

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-nesema-bg">
      {sidebar}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
