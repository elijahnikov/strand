"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "@omi/ui";

function Table({
  className,
  render,
  ...props
}: useRender.ComponentProps<"table">) {
  const defaultProps = {
    className: cn("w-full caption-bottom text-sm", className),
    "data-slot": "table",
  };

  return useRender({
    defaultTagName: "table",
    props: mergeProps<"table">(defaultProps, props),
    render,
  });
}

function TableHeader({
  className,
  render,
  ...props
}: useRender.ComponentProps<"thead">) {
  const defaultProps = {
    className: cn("[&_tr]:border-b", className),
    "data-slot": "table-header",
  };

  return useRender({
    defaultTagName: "thead",
    props: mergeProps<"thead">(defaultProps, props),
    render,
  });
}

function TableBody({
  className,
  render,
  ...props
}: useRender.ComponentProps<"tbody">) {
  const defaultProps = {
    className: cn("[&_tr:last-child]:border-0", className),
    "data-slot": "table-body",
  };

  return useRender({
    defaultTagName: "tbody",
    props: mergeProps<"tbody">(defaultProps, props),
    render,
  });
}

function TableFooter({
  className,
  render,
  ...props
}: useRender.ComponentProps<"tfoot">) {
  const defaultProps = {
    className: cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    ),
    "data-slot": "table-footer",
  };

  return useRender({
    defaultTagName: "tfoot",
    props: mergeProps<"tfoot">(defaultProps, props),
    render,
  });
}

function TableRow({
  className,
  render,
  ...props
}: useRender.ComponentProps<"tr">) {
  const defaultProps = {
    className: cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    ),
    "data-slot": "table-row",
  };

  return useRender({
    defaultTagName: "tr",
    props: mergeProps<"tr">(defaultProps, props),
    render,
  });
}

function TableHead({
  className,
  render,
  ...props
}: useRender.ComponentProps<"th">) {
  const defaultProps = {
    className: cn(
      "h-9 px-3 text-left align-middle font-medium text-ui-fg-muted [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    ),
    "data-slot": "table-head",
  };

  return useRender({
    defaultTagName: "th",
    props: mergeProps<"th">(defaultProps, props),
    render,
  });
}

function TableCell({
  className,
  render,
  ...props
}: useRender.ComponentProps<"td">) {
  const defaultProps = {
    className: cn(
      "px-3 py-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    ),
    "data-slot": "table-cell",
  };

  return useRender({
    defaultTagName: "td",
    props: mergeProps<"td">(defaultProps, props),
    render,
  });
}

export {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
