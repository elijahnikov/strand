import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@omi/ui";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const buttonVariants = cva(
  [
    "group relative inline-flex w-fit items-center justify-center rounded-lg outline-none",
    "disabled:border-ui-border-base disabled:opacity-50 disabled:after:hidden",
    "disabled:pointer-events-none",
    'after:absolute after:inset-0 after:content-[""]',
  ],
  {
    variants: {
      variant: {
        default: cn(
          "after:button-inverted-gradient bg-ui-button-inverted text-ui-fg-base shadow-buttons-neutral",
          "hover:bg-ui-button-inverted-hover",
          "active:bg-ui-button-inverted-pressed",
          "focus-visible:shadow-buttons-inverted-focus!"
        ),
        omi: cn(
          "border-[0.5px] border-blue-400 bg-linear-to-t from-blue-500 to-blue-400 text-white after:hidden",
          "hover:from-blue-600 hover:to-blue-500",
          "active:from-blue-700 active:to-blue-600",
          "focus-visible:shadow-buttons-recall-focus disabled:shadow-none"
        ),
        success: cn(
          "bg-linear-to-t from-green-500 to-green-400 text-white shadow-buttons-recall after:hidden",
          "hover:from-green-600 hover:to-green-500",
          "active:from-green-700 active:to-green-600",
          "focus-visible:shadow-buttons-recall-focus disabled:shadow-none",
          "disabled:text-green-200"
        ),
        outline: cn(
          "after:button-neutral-gradient bg-ui-button-neutral text-ui-fg-base shadow-buttons-neutral",
          "hover:after:button-neutral-hover-gradient hover:bg-ui-button-neutral-hover",
          "active:after:button-neutral-pressed-gradient active:bg-ui-button-neutral-pressed",
          "focus-visible:shadow-buttons-neutral-focus"
        ),
        secondary: cn(
          "bg-[rgba(0,0,0,0.05)] text-ui-fg-base dark:bg-[rgba(255,255,255,0.05)]",
          "hover:bg-[rgba(0,0,0,0.1)] dark:hover:bg-[rgba(255,255,255,0.1)]",
          "active:bg-[rgba(0,0,0,0.15)] dark:active:bg-[rgba(255,255,255,0.15)]",
          "focus-visible:bg-ui-bg-base focus-visible:shadow-buttons-neutral-focus",
          "disabled:bg-transparent! disabled:shadow-none!"
        ),
        ghost: cn(
          "after:hidden",
          "bg-ui-button-transparent text-ui-fg-base",
          "hover:bg-ui-button-transparent-hover",
          "active:bg-ui-button-transparent-pressed",
          "focus-visible:bg-ui-bg-base focus-visible:shadow-buttons-neutral-focus",
          "disabled:bg-transparent! disabled:shadow-none!"
        ),
        destructive: cn(
          "after:button-danger-gradient border-[0.5px] border-destructive/50 bg-ui-button-danger text-ui-fg-on-color",
          "hover:after:button-danger-hover-gradient hover:bg-ui-button-danger-hover",
          "active:after:button-danger-pressed-gradient active:bg-ui-button-danger-pressed",
          "focus-visible:shadow-buttons-danger-focus"
        ),
      },
      size: {
        xsmall: "txt-compact-xsmall-plus gap-x-0.5 px-2 py-0.5",
        small: "txt-compact-small-plus gap-x-1.5 px-2.5 py-1",
        base: "txt-compact-small-plus gap-x-1.5 px-3.5 py-1.5",
        large: "txt-compact-medium-plus gap-x-1.5 px-4.5 py-2.5",
        xlarge: "txt-compact-large-plus gap-x-1.5 px-5.5 py-3.5",
      },
    },
    defaultVariants: {
      size: "base",
      variant: "default",
    },
  }
);

export interface ButtonProps extends useRender.ComponentProps<"button"> {
  size?: VariantProps<typeof buttonVariants>["size"];
  variant?: VariantProps<typeof buttonVariants>["variant"];
}

function Button({ className, variant, size, render, ...props }: ButtonProps) {
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] =
    render ? undefined : "button";

  const defaultProps = {
    className: cn(buttonVariants({ className, size, variant })),
    "data-slot": "button",
    type: typeValue,
  };

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render,
  });
}

export { Button, buttonVariants };
