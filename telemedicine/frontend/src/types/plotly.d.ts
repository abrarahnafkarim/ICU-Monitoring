/**
 * Minimal type declaration for `plotly.js-dist-min`.
 *
 * The pre-bundled dist build does not ship its own type definitions, so we
 * declare just the slice of the Plotly API used by the live ECG chart.
 */
declare module "plotly.js-dist-min" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Data = any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Layout = any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Config = any;

  export function newPlot(
    root: HTMLElement,
    data: Data[],
    layout?: Partial<Layout>,
    config?: Partial<Config>
  ): Promise<void>;

  export function react(
    root: HTMLElement,
    data: Data[],
    layout?: Partial<Layout>,
    config?: Partial<Config>
  ): Promise<void>;

  export function extendTraces(
    root: HTMLElement,
    update: { [key: string]: unknown[][] },
    traceIndices: number[],
    maxPoints?: number
  ): Promise<void>;

  export function relayout(
    root: HTMLElement,
    update: Partial<Layout>
  ): Promise<void>;

  export function purge(root: HTMLElement): void;

  export const Plots: {
    resize(root: HTMLElement): void;
  };

  const Plotly: {
    newPlot: typeof newPlot;
    react: typeof react;
    extendTraces: typeof extendTraces;
    relayout: typeof relayout;
    purge: typeof purge;
    Plots: typeof Plots;
  };
  export default Plotly;
}
