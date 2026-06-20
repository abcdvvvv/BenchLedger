import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../ui/cn";

type DataKeyValueRowProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  value: ReactNode;
  layout?: "stacked" | "split";
  compact?: boolean;
  semantic?: "default" | "definition";
  valueTone?: "body" | "strong" | "muted" | "code";
  labelClassName?: string;
  valueClassName?: string;
};

export function DataKeyValueRow(props: DataKeyValueRowProps) {
  const {
    label,
    value,
    layout = "stacked",
    compact = false,
    semantic = "default",
    valueTone = "body",
    className,
    labelClassName,
    valueClassName,
    ...rest
  } = props;

  const valueClasses = cn(
    valueTone === "strong"
      ? "type-body-strong"
      : valueTone === "muted"
        ? "type-body-muted"
        : valueTone === "code"
          ? "type-body"
          : "type-body",
    valueTone === "code" && "break-all",
    layout === "stacked" && "mt-1",
    valueClassName
  );

  return (
    <div
      {...rest}
      className={cn(
        "surface-inset",
        compact ? "pad-field-compact" : "pad-field",
        layout === "split"
          ? "grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start"
          : undefined,
        className
      )}
    >
      {semantic === "definition" ? (
        <>
          <dt className={cn("type-table-head", labelClassName)}>{label}</dt>
          {valueTone === "strong" ? (
            <dd className={layout === "stacked" ? "mt-1" : undefined}>
              <strong className={cn("type-body-strong", valueClassName)}>{value}</strong>
            </dd>
          ) : valueTone === "code" ? (
            <dd className={layout === "stacked" ? "mt-1" : undefined}>
              <code className={cn("type-body break-all", valueClassName)}>{value}</code>
            </dd>
          ) : (
            <dd className={cn(valueClasses, "m-0")}>{value}</dd>
          )}
        </>
      ) : (
        <>
          <span className={cn("type-table-head", labelClassName)}>{label}</span>
          {valueTone === "strong" ? (
            <strong className={valueClasses}>{value}</strong>
          ) : valueTone === "code" ? (
            <code className={valueClasses}>{value}</code>
          ) : (
            <div className={valueClasses}>{value}</div>
          )}
        </>
      )}
    </div>
  );
}
