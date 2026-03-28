import { Field as FieldPrimitive } from "@base-ui/react/field";
import { mergeProps } from "@base-ui/react/merge-props";
import { cn } from "@strand/ui";
import type * as React from "react";

type TextareaProps = React.ComponentProps<"textarea"> & {
  size?: "sm" | "default" | "lg" | number;
};

function Textarea({ className, size = "default", ...props }: TextareaProps) {
  return (
    <span
      className={cn(className)}
      data-size={size}
      data-slot="textarea-control"
    >
      <FieldPrimitive.Control
        render={(defaultProps) => (
          <textarea
            className={cn(
              [
                "txt-compact-small relative w-full rounded-md bg-ui-bg-field-component text-ui-fg-base placeholder-ui-fg-muted caret-ui-fg-base shadow-borders-base outline-none transition-fg hover:bg-ui-bg-field-component-hover",
                "focus-visible:shadow-borders-interactive-with-active",
                "disabled:cursor-not-allowed disabled:bg-ui-bg-disabled! disabled:text-ui-fg-disabled disabled:placeholder-ui-fg-disabled",
                "invalid:shadow-borders-error! aria-invalid:shadow-borders-error!",
              ],
              "field-sizing-content min-h-17.5 w-full px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] outline-none max-sm:min-h-20.5",
              size === "sm" &&
                "max-h-16.5 min-h-16.5 px-[calc(--spacing(2.5)-1px)] py-[calc(--spacing(1)-1px)] max-sm:min-h-19.5",
              size === "lg" &&
                "min-h-18.5 py-[calc(--spacing(2)-1px)] max-sm:min-h-21.5"
            )}
            data-slot="textarea"
            {...mergeProps(defaultProps, props)}
          />
        )}
      />
    </span>
  );
}

export { Textarea, type TextareaProps };
