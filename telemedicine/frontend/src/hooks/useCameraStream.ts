import { useEffect, useRef, useState } from "react";

import { config } from "../config";
import type { ConnectionStatus } from "../types";

interface UseCameraStreamResult {
  /** Object URL of the latest JPEG frame (or null before the first frame). */
  frameUrl: string | null;
  /** WebSocket connection status to the relay. */
  status: ConnectionStatus;
  /** True while frames are actively arriving (camera is streaming). */
  live: boolean;
}

// If no frame arrives for this long, the feed is treated as "no signal".
const LIVE_TIMEOUT_MS = 2500;

/**
 * Subscribes to the `/ws/camera` relay and exposes the latest webcam frame as
 * an object URL. Each frame arrives as a binary Blob; we swap the `<img>` src
 * and revoke the previous URL to avoid leaking memory. Reconnects automatically.
 */
export function useCameraStream(): UseCameraStreamResult {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [live, setLive] = useState(false);

  const objectUrlRef = useRef<string | null>(null);
  const lastFrameAtRef = useRef(0);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let disposed = false;

    // Flip `live` off if frames stop arriving (camera unplugged / Pi stopped).
    const liveTimer = window.setInterval(() => {
      setLive(Date.now() - lastFrameAtRef.current < LIVE_TIMEOUT_MS);
    }, 1000);

    const showFrame = (blob: Blob) => {
      const next = URL.createObjectURL(blob);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = next;
      lastFrameAtRef.current = Date.now();
      setFrameUrl(next);
      setLive(true);
    };

    const connect = () => {
      if (disposed) return;
      setStatus("connecting");
      socket = new WebSocket(config.cameraSocketUrl);
      socket.binaryType = "blob";

      socket.onopen = () => setStatus("online");
      socket.onmessage = (event: MessageEvent) => {
        if (event.data instanceof Blob) showFrame(event.data);
      };
      socket.onclose = () => {
        setStatus("offline");
        setLive(false);
        if (!disposed) reconnectTimer = window.setTimeout(connect, 1500);
      };
      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      disposed = true;
      window.clearInterval(liveTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  return { frameUrl, status, live };
}
