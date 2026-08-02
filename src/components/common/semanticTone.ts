import { cn } from "../ui/cn";

export type SemanticTone = "neutral" | "positive" | "negative" | "warning" | "brand";

const Badge_Tone_Classes: Record<SemanticTone, string> = {
  positive: "bg-emerald-600/12 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-400",
  negative: "bg-red-600/12 text-red-600 dark:bg-red-500/18 dark:text-red-300",
  warning: "bg-stone-200 text-stone-500 dark:bg-stone-500/22 dark:text-stone-400",
  brand: "bg-amber-50 text-theme-brand dark:bg-amber-500/10",
  neutral: "bg-stone-200 text-stone-500 dark:bg-stone-500/22 dark:text-stone-400"
};

const Text_Tone_Classes: Record<SemanticTone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-300",
  warning: "text-stone-500 dark:text-stone-400",
  brand: "text-theme-brand",
  neutral: "text-stone-500 dark:text-stone-400"
};

export function semanticBadgeClassName(tone: SemanticTone = "neutral") {
  return cn("type-meta inline-flex items-center rounded-full px-2.5 py-1 font-medium", Badge_Tone_Classes[tone]);
}

export function semanticTextClassName(tone: SemanticTone = "neutral") {
  return Text_Tone_Classes[tone];
}

export function semanticSurfaceClassName(tone: Exclude<SemanticTone, "brand"> | "default" = "default") {
  return tone === "positive"
    ? "surface-card-positive"
    : tone === "negative"
      ? "surface-card-negative"
      : tone === "warning" ? "surface-card-warning" : "surface-card";
}
