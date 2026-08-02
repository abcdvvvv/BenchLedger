import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { Card } from "../ui/Card";
import { cn } from "../ui/cn";
import { semanticTextClassName, type SemanticTone } from "./semanticTone";

export function StatCard(props: {
  Icon: IconType;
  label: string;
  value: string;
  valueTone?: SemanticTone;
  delta?: string;
  deltaTone?: SemanticTone;
  detail: ReactNode;
  detailFullWidth?: boolean;
  inlineNoWrap?: boolean;
}) {
  const { Icon, detailFullWidth, inlineNoWrap } = props;
  return (
    <Card className={detailFullWidth
      ? "pad-card flex h-full flex-wrap items-start gap-x-4"
      : "pad-card flex h-full items-start gap-4"}>
      <div className="text-theme-brand flex size-8 shrink-0 items-center justify-center">
        <Icon className="size-7" aria-hidden="true" />
      </div>
      <div className="min-w-0 space-y-2">
        <p className="type-body-muted">{props.label}</p>
        <div className={cn("flex items-baseline gap-2", inlineNoWrap ? "min-w-0 flex-nowrap overflow-hidden" : "flex-wrap")}>
          <strong className={cn("type-page-title text-3xl leading-none", props.valueTone && semanticTextClassName(props.valueTone))}>{props.value}</strong>
          {props.delta ? (
            <span className={cn(
              "type-body-strong",
              semanticTextClassName(props.deltaTone ?? "neutral"),
              inlineNoWrap && "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
            )}>{props.delta}</span>
          ) : null}
        </div>
        {!detailFullWidth ? <p className="type-body-muted">{props.detail}</p> : null}
      </div>
      {detailFullWidth ? <div className="type-body-muted mt-2 w-full">{props.detail}</div> : null}
    </Card>
  );
}
