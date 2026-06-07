/**
 * Central runtime configuration.
 *
 * Backend base URL resolution (in priority order):
 *   1. `VITE_API_BASE` build-time override, if set.
 *   2. In dev (`npm run dev`): the local FastAPI dev server on :8000.
 *   3. In production (built app served BY FastAPI, e.g. on the Raspberry Pi):
 *      the same origin the page was loaded from — so it works whether opened
 *      on the Pi itself (localhost) or from another device (the Pi's IP).
 */
const DEFAULT_BASE = import.meta.env.DEV
  ? "http://localhost:8000"
  : window.location.origin;

const API_BASE = import.meta.env.VITE_API_BASE ?? DEFAULT_BASE;

// Derive the WebSocket origin from the HTTP base (http -> ws, https -> wss).
const WS_BASE = API_BASE.replace(/^http/, "ws");

export const config = {
  apiBase: API_BASE,
  ecgSocketUrl: `${WS_BASE}/ws/ecg`,
  /** How often (ms) to poll REST vitals. */
  vitalsPollInterval: 2000,
  /** Seconds of ECG history kept visible in the scrolling chart. */
  ecgWindowSeconds: 10,
} as const;

/** Hardcoded demo credentials (no backend auth in this demo). */
export const DEMO_CREDENTIALS = {
  username: "admin",
  password: "admin123",
} as const;
