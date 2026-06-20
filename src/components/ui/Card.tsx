import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export function Card(props: HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return (
    <div
      {...rest}
      className={cn(
        "surface-card",
        className
      )}
    />
  );
}

export function Panel(props: HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return <Card {...rest} className={cn("pad-card", className)} />;
}

export function Inset(props: HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return <div {...rest} className={cn("surface-inset pad-panel", className)} />;
}

export function SectionTitle(props: { title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between", props.className)}>
      <div className="space-y-2">
        <h2 className="type-section-title">{props.title}</h2>
        {props.description ? <p className="type-body-muted">{props.description}</p> : null}
      </div>
      {props.action ? <div className="flex shrink-0 items-center gap-3">{props.action}</div> : null}
    </div>
  );
}
