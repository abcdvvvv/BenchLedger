import type { ReactNode } from "react";
import { cn } from "../ui/cn";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader(props: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-5", props.className)}>
      <div className="space-y-2">
        {props.eyebrow ? <div className="type-eyebrow text-theme-brand">{props.eyebrow}</div> : null}
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-2 xl:flex-1">
            <h1 className="type-page-title">{props.title}</h1>
            {props.description ? <p className="type-body-muted max-w-3xl">{props.description}</p> : null}
          </div>
          {props.actions ? <div className="flex w-full min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-start xl:w-auto xl:flex-nowrap xl:justify-end xl:self-start">{props.actions}</div> : null}
        </div>
      </div>
    </header>
  );
}
