import Sidebar from "@/components/Sidebar";
import GroupWhitelist from "@/components/GroupWhitelist";
import CommandConfig from "@/components/CommandConfig";

export default function GroupSettings() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-card border-b border-border sticky top-0 z-10">
          <div className="px-8 py-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">群组设置</h2>
              <p className="text-sm text-muted-foreground mt-1">管理群组白名单和自定义指令</p>
            </div>
          </div>
        </header>

        {/* Settings Content */}
        <div className="p-8 space-y-6">
          {/* Two Column Layout: Groups & Commands */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GroupWhitelist />
            <CommandConfig />
          </div>
        </div>
      </main>
    </div>
  );
}
