import type { HTMLAttributes, ReactNode } from "react";
import { FiChevronDown } from "react-icons/fi";
import { cn } from "./cn";

type MenuItemRowState = "default" | "selected" | "tinted";
type MenuItemRowAlignment = "start" | "between" | "center";

type MenuItemRowClassNameOptions = {
  state?: MenuItemRowState;
  align?: MenuItemRowAlignment;
};

type MenuTriggerClassNameOptions = {
  disabled?: boolean;
};

type DisclosureTriggerContentProps = {
  children: ReactNode;
  align?: "start" | "center";
  chevron?: boolean;
  className?: string;
  contentClassName?: string;
};

type SelectionIndicatorState = "unchecked" | "checked" | "mixed";

export const Disclosure_Trigger_Icon_Class_Name = "size-4 shrink-0 text-white";

export function menuTriggerClassName(options?: MenuTriggerClassNameOptions) {
  return cn(
    "type-menu control-frame control-h-theme pad-control-x inline-flex w-full items-center justify-between gap-3 text-left shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15 focus-visible:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 focus-within:border-brand-500",
    "surface-control border-hover-theme",
    options?.disabled && "cursor-not-allowed opacity-60"
  );
}

export function menuSurfaceClassName(className?: string) {
  return cn("surface-floating pad-menu z-50 outline-none", className);
}

export function DisclosureTriggerContent(props: DisclosureTriggerContentProps) {
  const {
    children,
    align = "start",
    chevron = true,
    className,
    contentClassName
  } = props;

  return (
    <span className={cn("flex min-w-0 flex-1 items-center gap-3", align === "center" && "justify-center", className)}>
      <span className={cn("min-w-0 truncate", align === "start" ? "flex-1 text-left" : "text-center", contentClassName)}>
        {children}
      </span>
      {chevron ? <FiChevronDown aria-hidden="true" className={Disclosure_Trigger_Icon_Class_Name} /> : null}
    </span>
  );
}

export function menuItemRowClassName(options?: MenuItemRowClassNameOptions) {
  const state = options?.state ?? "default";
  const align = options?.align ?? "start";

  return cn(
    "type-menu radius-theme pad-menu-item surface-hover-theme flex items-center gap-2 outline-none transition",
    align === "between"
      ? "justify-between"
      : align === "center"
        ? "justify-center"
        : undefined,
    state === "selected"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
      : state === "tinted"
        ? "bg-amber-50/80 dark:bg-amber-500/10"
        : undefined
  );
}

export function MenuItemRow(props: HTMLAttributes<HTMLDivElement> & MenuItemRowClassNameOptions) {
  const {
    className,
    state,
    align,
    ...rest
  } = props;

  return <div {...rest} className={cn(menuItemRowClassName({ state, align }), className)} />;
}

export function MenuEmptyState(props: HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return <div {...rest} className={cn("type-body-muted pad-menu-item", className)} />;
}

export function selectionIndicatorClassName(state: SelectionIndicatorState) {
  return cn(
    "type-caption radius-theme flex size-4 items-center justify-center border-theme",
    state === "checked"
      ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
      : state === "mixed"
        ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
        : "border-stone-300 bg-white text-transparent dark:border-stone-600 dark:bg-[#18181b]"
  );
}
