import type {
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes
} from "react";
import { cn } from "./cn";

export function DataTableShell(props: HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return <div {...rest} className={cn("overflow-x-auto", className)} />;
}

export function DataTable(props: TableHTMLAttributes<HTMLTableElement>) {
  const { className, ...rest } = props;
  return <table {...rest} className={cn("type-table min-w-full border-separate border-spacing-0 text-left", className)} />;
}

export function DataHeadCell(props: ThHTMLAttributes<HTMLTableCellElement>) {
  const { className, ...rest } = props;
  return (
    <th
      {...rest}
      className={cn("type-table-head border-theme-b border-stone-200 pad-data-cell text-left dark:border-[#2f2f33]", className)}
    />
  );
}

type DataCellProps = TdHTMLAttributes<HTMLTableCellElement> & {
  tone?: "body" | "muted" | "plain";
  code?: boolean;
};

export function DataCell(props: DataCellProps) {
  const {
    children,
    className,
    tone = "body",
    code = false,
    ...rest
  } = props;

  return (
    <td
      {...rest}
      className={cn(
        "border-theme-b border-stone-200 pad-data-cell dark:border-[#2f2f33]",
        tone === "body" ? "type-body" : tone === "muted" ? "type-body-muted" : undefined,
        className
      )}
    >
      {code ? <code className="type-table">{children}</code> : children}
    </td>
  );
}

export function SortButton(props: { children: ReactNode; active?: boolean; onClick: () => void; indicator: string }) {
  return (
    <button
      type="button"
      className={cn(
        "type-body-strong inline-flex items-center gap-2",
        props.active ? "text-stone-900 dark:text-stone-100" : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
      )}
      onClick={props.onClick}
    >
      {props.children}
      <span className="type-meta">{props.indicator}</span>
    </button>
  );
}
