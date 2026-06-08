import { useEffect, useState } from "react";
import { Download } from "lucide-react";

/** The `beforeinstallprompt` event isn't in the standard DOM lib types. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "Install app" button. Appears only when the browser signals the app is
 * installable (Chrome / Edge / Android). Hides itself once installed or on
 * platforms that don't fire the event (e.g. iOS Safari, where the user adds
 * to Home Screen via the Share menu).
 */
export function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    null
  );

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPromptEvent(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!promptEvent) return null;

  const install = async () => {
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  };

  return (
    <button
      onClick={install}
      className="flex items-center gap-2 rounded-xl bg-primary/15 px-3 py-1.5 text-sm font-medium text-primary ring-1 ring-primary/25 transition-colors hover:bg-primary/25"
      aria-label="Install app"
    >
      <Download size={16} strokeWidth={2.2} />
      <span className="hidden sm:inline">Install App</span>
    </button>
  );
}
