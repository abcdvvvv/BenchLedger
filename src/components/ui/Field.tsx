import { forwardRef } from "react";
import type { HTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "./cn";

type ToolbarProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "card" | "plain";
};

export function Toolbar(props: ToolbarProps) {
  const { className, variant = "card", ...rest } = props;
  return <div {...rest} className={cn(variant === "plain" ? null : "surface-card pad-panel", className)} />;
}

export function ToolbarGrid(props: HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return <div {...rest} className={cn("grid gap-4 sidebar-icon:grid-cols-2 sidebar-expanded:grid-cols-4", className)} />;
}

export function Field(props: HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return <div {...rest} className={cn("flex min-w-0 flex-col gap-1", className)} />;
}

export function FieldLabel(props: HTMLAttributes<HTMLSpanElement>) {
  const { className, ...rest } = props;
  return <span {...rest} className={cn("type-label", className)} />;
}

type ControlClassNameOptions = {
  invalid?: boolean;
  active?: boolean;
};

function controlClassName(options?: ControlClassNameOptions) {
  return cn(
    "type-body control-h-theme pad-control-x w-full outline-none transition",
    options?.invalid
      ? "border-error-300 bg-error-25 text-error-700 focus:border-error-500 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-200"
      : options?.active
        ? "control-surface-selected ring-4 ring-brand-500/10"
        : "surface-control focus:border-brand-500"
  );
}

export function SelectField(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, "aria-invalid": ariaInvalid, ...rest } = props;
  return (
    <select
      {...rest}
      aria-invalid={ariaInvalid}
      className={cn(controlClassName({ invalid: ariaInvalid === true || ariaInvalid === "true" }), className)}
    >
      {children}
    </select>
  );
}

export const InputField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function InputField(props, ref) {
  const { className, "aria-invalid": ariaInvalid, ...rest } = props;
  return (
    <input
      ref={ref}
      {...rest}
      aria-invalid={ariaInvalid}
      className={cn(controlClassName({ invalid: ariaInvalid === true || ariaInvalid === "true" }), className)}
    />
  );
});
