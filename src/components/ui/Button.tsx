import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type CommonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "selected" | "success" | "warning" | "danger";
  size?: "normal" | "icon";
  shape?: "default" | "pill";
  className?: string;
};

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: never;
};

type LinkButtonProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

const Base_Classes = "type-label control-frame focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15";
const Variant_Classes = {
  primary: "control-surface-primary",
  secondary: "surface-control border-hover-theme",
  ghost: "control-surface-ghost",
  selected: "control-surface-selected",
  success: "control-surface-success",
  warning: "control-surface-warning",
  danger: "control-surface-danger"
} as const;
const Size_Classes = {
  normal: "control-h-theme px-3",
  icon: "control-size-theme shrink-0"
} as const;
const Shape_Classes = {
  default: "radius-theme",
  pill: "control-frame-pill"
} as const;

type ButtonClassNameOptions = {
  variant?: CommonProps["variant"];
  size?: CommonProps["size"];
  shape?: CommonProps["shape"];
  className?: string;
};

export function buttonClassName(options?: ButtonClassNameOptions) {
  const variant = options?.variant ?? "secondary";
  const size = options?.size ?? "normal";
  const shape = options?.shape ?? "default";

  return cn(
    Base_Classes,
    Variant_Classes[variant],
    Size_Classes[size],
    Shape_Classes[shape],
    options?.className
  );
}

export function Button(props: ButtonProps | LinkButtonProps) {
  const {
    children,
    variant = "secondary",
    size = "normal",
    shape = "default",
    className,
    ...rest
  } = props;

  const classes = buttonClassName({ variant, size, shape, className });

  if ("href" in props && props.href) {
    const linkProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return <a {...linkProps} className={classes}>{children}</a>;
  }

  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return <button {...buttonProps} className={classes}>{children}</button>;
}
