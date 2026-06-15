import { useCallback, useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";
import { Activity } from "lucide-react";

import { config } from "../config";
import { useEcgStream } from "../hooks/useEcgStream";
import { useSimulatedEcg } from "../hooks/useSimulatedEcg";
import type { ConnectionStatus, EcgSample } from "../types";
import { Card } from "./ui/Card";
import { OnlineIndicator } from "./ui/OnlineIndicator";

const WINDOW_SECONDS = config.ecgWindowSeconds;
const LINE_COLOR = "#34D399"; // bright medical green
const GRID_COLOR = "rgba(148, 163, 184, 0.12)";
const AXIS_COLOR = "#94A3B8";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  online: "Streaming",
  offline: "Reconnecting…",
};

/**
 * Sets up the Plotly WebGL trace and returns a ref for the plot container plus
 * a `handleSamples` callback that appends batches and scrolls the window.
 * Shared by both the live (WebSocket) and simulated ECG charts.
 */
function useEcgPlot() {
  const plotRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const maxPointsRef = useRef(WINDOW_SECONDS * 250);

  // --- Initialise the Plotly chart once on mount. ----------------------- //
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;

    const trace = {
      x: [] as number[],
      y: [] as number[],
      type: "scattergl",
      mode: "lines",
      line: { color: LINE_COLOR, width: 2, shape: "linear" },
      hoverinfo: "skip",
    };

    const layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: AXIS_COLOR, family: "Inter, sans-serif", size: 12 },
      margin: { l: 56, r: 20, t: 10, b: 44 },
      showlegend: false,
      xaxis: {
        title: { text: "Time (s)", font: { size: 12, color: AXIS_COLOR } },
        color: AXIS_COLOR,
        gridcolor: GRID_COLOR,
        zeroline: false,
        fixedrange: true,
        range: [-WINDOW_SECONDS, 0],
      },
      yaxis: {
        title: { text: "Amplitude (mV)", font: { size: 12, color: AXIS_COLOR } },
        color: AXIS_COLOR,
        gridcolor: GRID_COLOR,
        zeroline: false,
        fixedrange: true,
        range: [-0.6, 1.3],
      },
    };

    const plotlyConfig = { displayModeBar: false, responsive: true };

    Plotly.newPlot(el, [trace], layout, plotlyConfig).then(() => {
      readyRef.current = true;
    });

    const handleResize = () => Plotly.Plots.resize(el);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      readyRef.current = false;
      Plotly.purge(el);
    };
  }, []);

  // --- Append each incoming batch and scroll the window. ---------------- //
  const handleSamples = useCallback((samples: EcgSample[], sampleRate: number) => {
    const el = plotRef.current;
    if (!el || !readyRef.current || samples.length === 0) return;

    maxPointsRef.current = WINDOW_SECONDS * sampleRate;
    const xs = samples.map((s) => s.t);
    const ys = samples.map((s) => s.v);
    const latest = xs[xs.length - 1];

    Plotly.extendTraces(el, { x: [xs], y: [ys] }, [0], maxPointsRef.current);
    Plotly.relayout(el, { "xaxis.range": [latest - WINDOW_SECONDS, latest] });
  }, []);

  return { plotRef, handleSamples };
}

/** Presentational ECG card shared by the live and simulated variants. */
function EcgCard({
  plotRef,
  status,
}: {
  plotRef: React.RefObject<HTMLDivElement>;
  status: ConnectionStatus;
}) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10 text-success">
            <Activity size={18} strokeWidth={2.2} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-text">
              Live ECG Monitoring
            </h2>
            <p className="text-xs text-muted">
              Lead I · last {WINDOW_SECONDS}s · AD8232
            </p>
          </div>
        </div>
        <OnlineIndicator
          online={status === "online"}
          label={STATUS_LABEL[status]}
        />
      </div>

      <div className="h-[300px] w-full sm:h-[340px]" ref={plotRef} />
    </Card>
  );
}

/** Live ECG from the `/ws/ecg` WebSocket (Patient 1 / the Pi). */
function LiveEcgChart() {
  const { plotRef, handleSamples } = useEcgPlot();
  const status = useEcgStream(handleSamples);
  return <EcgCard plotRef={plotRef} status={status} />;
}

/** Independent, browser-simulated ECG (Patient 2). */
function SimulatedEcgChart() {
  const { plotRef, handleSamples } = useEcgPlot();
  useSimulatedEcg(handleSamples, 88);
  return <EcgCard plotRef={plotRef} status="online" />;
}

/**
 * Real-time scrolling ECG waveform — the visual centerpiece of the dashboard.
 *
 * Patient 1 streams from the `/ws/ecg` WebSocket (the Pi, or its simulation
 * fallback). Patient 2 runs an independent in-browser simulation so its trace
 * is visibly different.
 */
export function EcgChart({ patientId }: { patientId?: string }) {
  return patientId === "P-002" ? <SimulatedEcgChart /> : <LiveEcgChart />;
}
