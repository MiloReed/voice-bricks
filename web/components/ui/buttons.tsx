"use client";

import { Slot, Slottable } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "primary" | "secondary" | "quiet";
  icon?: ReactNode;
};

export function Button({
  asChild,
  variant = "primary",
  icon,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={`button button-${variant} ${className}`} {...props}>
      <Slottable>{children}</Slottable>
      {icon && <span className="button-icon" aria-hidden="true">{icon}</span>}
    </Comp>
  );
}
