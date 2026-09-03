import { useEffect, useRef, type HTMLAttributes } from "react";
import type { Config, Data, Layout } from "plotly.js";
import Plotly from "../../../lib/plotly";

type PlotProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & { data: Data[]; layout?: Partial<Layout>; config?: Partial<Config>; useResizeHandler?: boolean };

export function createPlotRuntime(element: HTMLDivElement) {
  let disposed = false, rendered = false, resizeEnabled = false, renderGeneration = 0, observedWidth = 0, observedHeight = 0;
  let observer: ResizeObserver | null = null;
  return {
    async render(data: Data[], layout?: Partial<Layout>, config?: Partial<Config>) {
      const generation = ++renderGeneration;
      try {
        await Plotly.react(element, data, layout, config);
        if (disposed || generation !== renderGeneration) return;
        rendered = true;
      } catch (error: unknown) {
        if (disposed || generation !== renderGeneration) return;
        rendered = false;
        console.error("Failed to render Plotly chart.", error);
      }
    },
    setResizeHandler(enabled: boolean) {
      if (resizeEnabled === enabled || disposed) return;
      resizeEnabled = enabled;
      observer?.disconnect(); observer = null;
      if (!enabled) return;
      observedWidth = element.clientWidth; observedHeight = element.clientHeight;
      observer = new ResizeObserver((entries) => {
        if (!rendered) return;
        const rect = entries[0]?.contentRect;
        const width = rect?.width ?? element.clientWidth, height = rect?.height ?? element.clientHeight;
        if (width === observedWidth && height === observedHeight) return;
        observedWidth = width; observedHeight = height; Plotly.Plots.resize(element);
      });
      observer.observe(element);
    },
    dispose() {
      if (disposed) return;
      disposed = true; rendered = false; ++renderGeneration;
      observer?.disconnect(); observer = null;
      Plotly.purge(element);
    }
  };
}

export default function Plot({ data, layout, config, useResizeHandler = false, ...divProps }: PlotProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ReturnType<typeof createPlotRuntime> | null>(null);
  useEffect(() => {
    if (!rootRef.current) return;
    const runtime = createPlotRuntime(rootRef.current); runtimeRef.current = runtime;
    return () => { runtime.dispose(); runtimeRef.current = null; };
  }, []);
  useEffect(() => { void runtimeRef.current?.render(data, layout, config); }, [data, layout, config]);
  useEffect(() => { runtimeRef.current?.setResizeHandler(useResizeHandler); }, [useResizeHandler]);
  return <div {...divProps} ref={rootRef} />;
}
