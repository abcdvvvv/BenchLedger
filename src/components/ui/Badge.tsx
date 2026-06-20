import type { ReactNode } from "react";
import { cn } from "./cn";
import { semanticBadgeClassName, type SemanticTone } from "../common/semanticTone";

export function StatusBadge(props: { children: ReactNode; tone?: SemanticTone; className?: string }) {
  const tone = props.tone ?? "neutral";
  return (
    <span className={cn(
      semanticBadgeClassName(tone),
      props.className
    )}>
      {props.children}
    </span>
  );
}
