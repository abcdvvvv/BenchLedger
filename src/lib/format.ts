export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function parseDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

export function formatDate(value: string): string {
  const date = parseDate(value);
  if (!date) return value || "n/a";
  return `${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  })} ${date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

export function formatRuntime(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  if (value < 1_000) return `${value.toFixed(1)} ns`;
  if (value < 1_000_000) return `${(value / 1_000).toFixed(2)} us`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(2)} ms`;
  return `${(value / 1_000_000_000).toFixed(2)} s`;
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  if (value < 1024) return `${value.toLocaleString()} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(2)} KiB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(2)} MiB`;
  return `${(value / 1024 ** 3).toFixed(2)} GiB`;
}

export function percentageChange(current: number, baseline: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline === 0) return Number.NaN;
  return ((current - baseline) / baseline) * 100;
}

const Percent_Digits = 1;
const Neutral_Delta_Threshold = 0.5 * 10 ** -Percent_Digits;

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(Percent_Digits)}%`;
}

export function deltaClass(value: number): "up" | "down" | "neutral" {
  if (!Number.isFinite(value)) return "neutral";
  if (Math.abs(value) < Neutral_Delta_Threshold) return "neutral";
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "neutral";
}

export function shortCommit(commitSha: string): string {
  return commitSha ? commitSha.slice(0, 7) : "";
}
