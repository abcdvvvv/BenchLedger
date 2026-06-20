import type { ReactNode } from "react";
import { cn } from "../ui/cn";
import { semanticSurfaceClassName, type SemanticTone } from "./semanticTone";

export function Banner(props: { title: string; description: string; action?: ReactNode; tone?: Exclude<SemanticTone, "brand"> | "default"; className?: string }) {
  const tone = props.tone ?? "default";
  return (
    <div className={cn(
      "pad-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
      semanticSurfaceClassName(tone),
      props.className
    )}>
      <div className="space-y-1">
        <strong className="type-card-title block">{props.title}</strong>
        <p className="type-body-muted">{props.description}</p>
      </div>
      {props.action ? <div className="shrink-0">{props.action}</div> : null}
    </div>
  );
}
