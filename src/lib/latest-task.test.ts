import { describe, expect, it } from "vitest";
import { LatestTaskRunner } from "./latest-task";

describe("LatestTaskRunner", () => {
  it("runs the active task and coalesces queued work to the latest task", async () => {
    const runner = new LatestTaskRunner<number>(); let release!: () => void; const calls: number[] = [];
    const first = runner.run(() => new Promise<number>((resolve) => { calls.push(1); release = () => resolve(1); }));
    const second = runner.run(async () => { calls.push(2); return 2; });
    const third = runner.run(async () => { calls.push(3); return 3; });
    release();
    await expect(first).resolves.toBe(1); await expect(second).resolves.toBe(3); await expect(third).resolves.toBe(3); expect(calls).toEqual([1, 3]);
  });
});
