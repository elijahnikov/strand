import { ConnectScreen } from "@/components/connect-screen";
import { MenuScreen } from "@/components/menu-screen";
import { useAuth } from "@/hooks/use-auth";

export function App() {
  const { auth, status, disconnect } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex h-24 items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!auth) {
    return <ConnectScreen />;
  }

  return <MenuScreen onDisconnect={() => void disconnect()} />;
}
