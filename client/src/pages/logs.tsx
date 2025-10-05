import Sidebar from "@/components/Sidebar";
import ActivityLog from "@/components/ActivityLog";

export default function Logs() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-card border-b border-border sticky top-0 z-10">
          <div className="px-8 py-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">活动日志</h2>
              <p className="text-sm text-muted-foreground mt-1">查看系统日志和群组操作记录</p>
            </div>
          </div>
        </header>

        {/* Logs Content */}
        <div className="p-8">
          <ActivityLog />
        </div>
      </main>
    </div>
  );
}
