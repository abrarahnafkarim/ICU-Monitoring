import { Video, VideoOff } from "lucide-react";

import { useCameraStream } from "../hooks/useCameraStream";
import { Card } from "./ui/Card";
import { OnlineIndicator } from "./ui/OnlineIndicator";

/** Live patient webcam feed (JPEG frames relayed from the Pi). */
export function CameraFeed() {
  const { frameUrl, status, live } = useCameraStream();
  const connected = status === "online";
  const label = live ? "Live" : connected ? "No signal" : "Offline";

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Video size={18} strokeWidth={2.2} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-text">Patient Camera</h2>
            <p className="text-xs text-muted">Live video feed</p>
          </div>
        </div>
        <OnlineIndicator online={live} label={label} />
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black/50 ring-1 ring-white/5">
        {frameUrl ? (
          <img
            src={frameUrl}
            alt="Patient camera feed"
            className={`h-full w-full object-contain transition-opacity duration-300 ${
              live ? "opacity-100" : "opacity-40"
            }`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted">
            <VideoOff size={28} strokeWidth={1.8} />
            <span className="text-sm">
              {connected ? "Waiting for camera…" : "Connecting…"}
            </span>
          </div>
        )}

        {/* "No signal" overlay when a frame is frozen (stream stopped). */}
        {frameUrl && !live && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-muted">
              No signal
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
