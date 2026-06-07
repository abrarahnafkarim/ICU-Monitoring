import { useEffect, useRef, useState } from "react";

import { config } from "../config";
import type { ConnectionStatus, EcgMessage, EcgSample } from "../types";

type SamplesHandler = (samples: EcgSample[], sampleRate: number) => void;

/**
 * Opens the `/ws/ecg` WebSocket and forwards each batch of samples to the
 * supplied handler. Automatically reconnects if the connection drops.
 *
 * The handler is stored in a ref so the socket is *not* re-created when the
 * caller passes a new function instance on every render.
 *
 * @returns the live connection status.
 */
export function useEcgStream(onSamples: SamplesHandler): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const handlerRef = useRef<SamplesHandler>(onSamples);
  handlerRef.current = onSamples;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      setStatus("connecting");
      socket = new WebSocket(config.ecgSocketUrl);

      socket.onopen = () => setStatus("online");

      socket.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data as string) as EcgMessage;
          handlerRef.current(message.samples, message.sample_rate);
        } catch {
          /* ignore malformed frame */
        }
      };

      socket.onclose = () => {
        setStatus("offline");
        if (!disposed) {
          reconnectTimer = window.setTimeout(connect, 1500);
        }
      };

      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return status;
}
