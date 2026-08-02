import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { Button } from "./Button";

type CommonProps = {
  children: ReactNode;
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "selected" | "success" | "warning" | "danger";
  className?: string;
};

type ButtonIconProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: never;
  buttonRef?: Ref<HTMLButtonElement>;
};

type LinkIconProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

export function IconButton(props: ButtonIconProps | LinkIconProps) {
  if (typeof props.href === "string") {
    const { children, label, variant = "secondary", className, href, ...rest } = props;
    return (
      <Button
        {...rest}
        href={href}
        variant={variant}
        size="icon"
        shape="pill"
        className={className}
        aria-label={label}
        title={props.title ?? label}
      >
        {children}
      </Button>
    );
  }

  const { children, label, variant = "secondary", className, buttonRef, ...rest } = props;
  return (
    <Button
      {...rest}
      buttonRef={buttonRef}
      variant={variant}
      size="icon"
      shape="pill"
      className={className}
      aria-label={label}
      title={props.title ?? label}
    >
      {children}
    </Button>
  );
}
