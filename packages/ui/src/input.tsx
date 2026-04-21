"use client";

import { cn } from "@omi/ui";
import { RiEyeLine, RiEyeOffLine, RiSearchLine } from "@remixicon/react";
import { cva, type VariantProps } from "class-variance-authority";
import React from "react";

const inputBaseStyles = cn(
  "relative w-full appearance-none rounded-lg border-[0.5px] bg-ui-bg-field-component text-ui-fg-base placeholder-ui-fg-muted caret-ui-fg-base outline-none transition-fg hover:bg-ui-bg-field-component-hover",
  "focus-visible:shadow-borders-interactive-with-active",
  "disabled:cursor-not-allowed disabled:bg-ui-bg-disabled! disabled:text-ui-fg-disabled disabled:placeholder-ui-fg-disabled",
  "invalid:shadow-borders-error! aria-invalid:shadow-borders-error!"
);

const inputVariants = cva(
  [
    inputBaseStyles,
    "[&::--webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
  ],
  {
    variants: {
      size: {
        base: "txt-compact-medium h-8 px-3 py-1.5",
        small: "txt-compact-medium h-7 px-3 py-1",
      },
    },
    defaultVariants: {
      size: "base",
    },
  }
);

interface InputProps
  extends VariantProps<typeof inputVariants>,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * This component is based on the `input` element and supports all of its props
 */
const Input = ({
  className,
  type,
  /**
   * The input's size.
   */
  size = "base",
  ref,
  ...props
}: InputProps) => {
  const [typeState, setTypeState] = React.useState(type);

  const isPassword = type === "password";
  const isSearch = type === "search";

  return (
    <div className="relative w-full">
      <input
        className={cn(
          inputVariants({ size }),
          {
            "pl-8": isSearch && size === "base",
            "pr-8": isPassword && size === "base",
            "pl-7": isSearch && size === "small",
            "pr-7": isPassword && size === "small",
          },
          className
        )}
        ref={ref}
        type={isPassword ? typeState : type}
        {...props}
      />
      {isSearch && (
        <div
          className={cn(
            "pointer-events-none absolute bottom-0 left-0 flex items-center justify-center text-ui-fg-muted [&_svg]:size-4",
            {
              "h-8 w-8": size === "base",
              "h-7 w-7": size === "small",
            }
          )}
          role="img"
        >
          <RiSearchLine />
        </div>
      )}
      {isPassword && (
        <div
          className={cn(
            "absolute right-0 bottom-0 flex items-center justify-center border-l",
            {
              "h-8 w-8": size === "base",
              "h-7 w-7": size === "small",
            }
          )}
        >
          <button
            className="h-fit w-fit rounded-sm text-ui-fg-muted outline-none transition-all hover:text-ui-fg-base focus-visible:text-ui-fg-base focus-visible:shadow-borders-interactive-with-focus active:text-ui-fg-base [&_svg]:size-4"
            onClick={() => {
              setTypeState(typeState === "password" ? "text" : "password");
            }}
            type="button"
          >
            <span className="sr-only">
              {typeState === "password" ? "Show password" : "Hide password"}
            </span>
            {typeState === "password" ? <RiEyeLine /> : <RiEyeOffLine />}
          </button>
        </div>
      )}
    </div>
  );
};
Input.displayName = "Input";

export { Input, type InputProps, inputBaseStyles };
