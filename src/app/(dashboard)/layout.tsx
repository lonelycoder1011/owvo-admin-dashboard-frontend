import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export default function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <div className="app-shell">
        <Sidebar />
        <main className="main">
          <Topbar />
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
