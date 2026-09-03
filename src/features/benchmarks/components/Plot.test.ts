import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ react: vi.fn<() => Promise<void>>(), resize: vi.fn(), purge: vi.fn() }));
vi.mock("../../../lib/plotly", () => ({ default: { react: mocks.react, purge: mocks.purge, Plots: { resize: mocks.resize } } }));
const { react, resize, purge } = mocks;

import { createPlotRuntime } from "./Plot";

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();
  constructor(readonly callback: ResizeObserverCallback) { MockResizeObserver.instances.push(this); }
  fire(width: number, height: number) { this.callback([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
}

describe("Plot runtime", () => {
  beforeEach(() => {
    react.mockReset().mockResolvedValue(undefined);
    resize.mockReset();
    purge.mockReset();
    MockResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  it("renders, resizes, updates, and purges", async () => {
    const element = { clientWidth: 800, clientHeight: 400 } as HTMLDivElement;
    const runtime = createPlotRuntime(element);
    runtime.setResizeHandler(true);
    await runtime.render([{ x: [1], y: [2], type: "scatter" }]);
    expect(react).toHaveBeenCalledTimes(1);
    expect(resize).not.toHaveBeenCalled();
    expect(MockResizeObserver.instances[0].observe).toHaveBeenCalledWith(element);
    MockResizeObserver.instances[0].fire(800, 400);
    expect(resize).not.toHaveBeenCalled();
    MockResizeObserver.instances[0].fire(900, 400);
    expect(resize).toHaveBeenCalledOnce();
    expect(resize).toHaveBeenCalledWith(element);
    await runtime.render([{ x: [2], y: [3], type: "scatter" }]);
    expect(react).toHaveBeenCalledTimes(2);
    runtime.dispose();
    expect(MockResizeObserver.instances[0].disconnect).toHaveBeenCalledOnce();
    expect(purge).toHaveBeenCalledWith(element);
  });

  it("ignores stale render completion after disposal", async () => {
    let resolveRender: (() => void) | undefined;
    react.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveRender = resolve; }));
    const runtime = createPlotRuntime({} as HTMLDivElement);
    runtime.setResizeHandler(true);
    const pending = runtime.render([]);
    runtime.dispose();
    resolveRender?.();
    await pending;
    expect(resize).not.toHaveBeenCalled();
    expect(purge).toHaveBeenCalledOnce();
  });
});
