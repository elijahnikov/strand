"use client";

import { cn } from "@strand/ui";
import type React from "react";
import { Button, type ButtonProps } from "./button";
import Loader from "./loader";

export interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

const LoadingButton = ({
  loading = false,
  variant = "default",
  className,
  children,
  disabled,
  size = "base",
  ref,
  ...props
}: LoadingButtonProps) => (
  <Button
    className={cn(
      className,
      "relative flex items-center justify-center",
      loading && "pointer-events-none"
    )}
    disabled={disabled || loading}
    ref={ref}
    size={size}
    variant={variant}
    {...props}
  >
    <span
      className={cn(
        loading ? "opacity-0" : "opacity-100",
        "flex items-center justify-center gap-2"
      )}
    >
      {children}
    </span>
    <div
      className={cn(
        "absolute inset-0 grid place-items-center text-current",
        loading ? "opacity-100" : "opacity-0"
      )}
    >
      <Loader className="animate-spin" />
    </div>
  </Button>
);

LoadingButton.displayName = "LoadingButton";

export { LoadingButton };
