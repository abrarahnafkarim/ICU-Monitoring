import { useEffect, useRef } from "react";

import type { EcgSample } from "../types";

type SamplesHandler = (samples: EcgSample[], sampleRate: number) => void;

const SAMPLE_RATE = 250;
const BATCH_SIZE = 10;
const BATCH_INTERVAL_MS = (BATCH_SIZE / SAMPLE_RATE) * 1000; // ~40ms

/** A single Gaussian deflection used to model one ECG wave. */
function gaussian(x: number, center: number, width: number, amp: number): number {
  return amp * Math.exp(-((x - center) ** 2) / (2 * width * width));
}

/** ECG amplitude for a cardiac-cycle phase in [0, 1) — P, QRS, T morphology. */
function ecgWaveform(phase: number): number {
  let v = 0;
  v += gaussian(phase, 0.18, 0.028, 0.12); // P wave
  v += gaussian(phase, 0.295, 0.009, -0.14); // Q
  v += gaussian(phase, 0.33, 0.0095, 1.05); // R (tall spike)
  v += gaussian(phase, 0.365, 0.0095, -0.28); // S
  v += gaussian(phase, 0.56, 0.05, 0.32); // T wave
  return v;
}

/**
 * Generates a realistic ECG trace entirely in the browser (no WebSocket) and
 * feeds it to the chart in the same batch format as `useEcgStream`.
 *
 * Used for Patient 2, whose data is fully independent of the Pi. The trace runs
 * at a configurable heart rate so it visibly differs from Patient 1.
 */
export function useSimulatedEcg(
  onSamples: SamplesHandler,
  heartRate = 88,
): void {
  const handlerRef = useRef<SamplesHandler>(onSamples);
  handlerRef.current = onSamples;
  const hrRef = useRef(heartRate);
  hrRef.current = heartRate;

  useEffect(() => {
    let phase = 0;
    let elapsed = 0;
    let sampleIndex = 0;

    const timer = window.setInterval(() => {
      const samples: EcgSample[] = [];
      for (let i = 0; i < BATCH_SIZE; i += 1) {
        const beatsPerSecond = hrRef.current / 60;
        phase += beatsPerSecond / SAMPLE_RATE;
        if (phase >= 1) phase -= 1;

        let amp = ecgWaveform(phase);
        amp += 0.025 * Math.sin(2 * Math.PI * 0.25 * elapsed); // baseline wander
        amp += (Math.random() - 0.5) * 0.024; // sensor noise

        samples.push({
          t: Math.round((sampleIndex / SAMPLE_RATE) * 1e4) / 1e4,
          v: Math.round(amp * 1e4) / 1e4,
        });
        sampleIndex += 1;
        elapsed += 1 / SAMPLE_RATE;
      }
      handlerRef.current(samples, SAMPLE_RATE);
    }, BATCH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);
}
