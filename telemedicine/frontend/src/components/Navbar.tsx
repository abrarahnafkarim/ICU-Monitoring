import { Activity, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { useClock } from "../hooks/useClock";
import { InstallButton } from "./InstallButton";
import { OnlineIndicator } from "./ui/OnlineIndicator";

interface NavbarProps {
  /** Whether the live data link is currently healthy. */
  online?: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Top application bar: system identity on the left, live status + clock on the right. */
export function Navbar({ online = true }: NavbarProps) {
  const now = useClock();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="safe-top sticky top-0 z-20 border-b border-white/5 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pb-3 sm:px-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 text-left"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
            <Activity size={20} strokeWidth={2.4} />
          </span>
          <span className="hidden sm:block">
            <span className="block text-sm font-semibold leading-tight text-text">
              Remote Patient Monitoring
            </span>
            <span className="block text-xs leading-tight text-muted">
              Continuous Health Monitoring Platform
            </span>
          </span>
        </button>

        <div className="flex items-center gap-3 sm:gap-5">
          <span className="hidden font-mono text-sm tabular-nums text-muted sm:block">
            {formatTime(now)}
          </span>
          <OnlineIndicator online={online} label={online ? "Online" : "Offline"} />
          <InstallButton />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-white/[0.06] hover:text-text"
          >
            <LogOut size={16} strokeWidth={2.2} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
