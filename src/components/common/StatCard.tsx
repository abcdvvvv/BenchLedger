import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { Card } from "../ui/Card";
import { cn } from "../ui/cn";
import { semanticTextClassName, type SemanticTone } from "./semanticTone";

export function StatCard(props: {
  Icon: IconType;
  label: string;
  value: string;
  delta?: string;
  deltaTone?: SemanticTone;
  detail: ReactNode;
  detailFullWidth?: boolean;
}) {
  const Icon = props.Icon;

  if (props.detailFullWidth) {
    return (
      <Card className="pad-card flex h-full flex-wrap items-start gap-x-4">
        <div className="text-theme-brand flex size-8 shrink-0 items-center justify-center">
          <Icon className="size-7" aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="type-body-muted">{props.label}</p>
          <div className="flex flex-wrap items-baseline gap-2">
            <strong className="type-page-title text-3xl leading-none">{props.value}</strong>
            {props.delta ? <span className={cn("type-body-strong", semanticTextClassName(props.deltaTone ?? "neutral"))}>{props.delta}</span> : null}
          </div>
        </div>
        <div className="type-body-muted mt-2 w-full">{props.detail}</div>
      </Card>
    );
  }

  return (
    <Card className="pad-card flex h-full items-start gap-4">
      <div className="text-theme-brand flex size-8 shrink-0 items-center justify-center">
        <Icon className="size-7" aria-hidden="true" />
      </div>
      <div className="min-w-0 space-y-2">
        <p className="type-body-muted">{props.label}</p>
        <div className="flex flex-wrap items-baseline gap-2">
          <strong className="type-page-title text-3xl leading-none">{props.value}</strong>
          {props.delta ? <span className={cn("type-body-strong", semanticTextClassName(props.deltaTone ?? "neutral"))}>{props.delta}</span> : null}
        </div>
        <p className="type-body-muted">{props.detail}</p>
      </div>
    </Card>
  );
}
