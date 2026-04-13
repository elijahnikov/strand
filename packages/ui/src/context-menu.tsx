"use client";

import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { RiArrowRightSFill, RiCheckFill, RiCircleFill } from "@remixicon/react";
import { cn } from "@strand/ui";
import type * as React from "react";

function Menu({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function MenuTrigger({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return (
    <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
  );
}

function MenuGroup({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Group>) {
  return (
    <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
  );
}

function MenuPortal({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Portal>) {
  return (
    <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
  );
}

function MenuSub({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubmenuRoot>) {
  return (
    <ContextMenuPrimitive.SubmenuRoot data-slot="context-menu-sub" {...props} />
  );
}

function MenuRadioGroup({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioGroup>) {
  return (
    <ContextMenuPrimitive.RadioGroup
      data-slot="context-menu-radio-group"
      {...props}
    />
  );
}

function MenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubmenuTrigger> & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      className={cn(
        "txt-compact-small relative flex cursor-pointer select-none items-center rounded-md bg-ui-bg-component px-2 py-1.5 text-ui-fg-base outline-none transition-colors",
        "focus:bg-ui-bg-component-hover focus-visible:bg-ui-bg-component-hover",
        "active:bg-ui-bg-component-hover",
        "data-disabled:pointer-events-none data-disabled:text-ui-fg-disabled",
        "data-[state=open]:bg-ui-bg-component-hover!",
        className
      )}
      data-inset={inset}
      data-slot="context-menu-sub-trigger"
      {...props}
    >
      {children}
      <RiArrowRightSFill className="ml-auto text-ui-fg-muted" />
    </ContextMenuPrimitive.SubmenuTrigger>
  );
}

function MenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Popup>) {
  return (
    <ContextMenuPrimitive.Popup
      className={cn(
        "z-30 max-h-[var(--radix-popper-available-height)] min-w-[220px] overflow-hidden rounded-lg border bg-ui-bg-component p-1 text-ui-fg-base shadow-md",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=open]:animate-in",
        className
      )}
      data-slot="context-menu-sub-content"
      {...props}
    />
  );
}

function MenuContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Popup>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner className="z-50">
        <ContextMenuPrimitive.Popup
          className={cn(
            "z-30 max-h-[var(--radix-popper-available-height)] min-w-[220px] overflow-hidden rounded-2xl border-[0.5px] bg-ui-bg-component p-1 text-ui-fg-base outline-none",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=open]:animate-in",
            className
          )}
          data-slot="context-menu-content"
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
}

function MenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        "txt-compact-small relative flex cursor-pointer select-none items-center rounded-xl bg-ui-bg-component px-2 py-1.5 font-medium text-ui-fg-subtle outline-none transition-colors [&_svg]:mr-2 [&_svg]:size-4 [&_svg]:text-ui-fg-base",
        "focus:bg-ui-bg-component-hover focus:text-ui-fg-base focus-visible:bg-ui-bg-component-hover focus:[&_svg]:text-ui-fg-base!",
        "active:bg-ui-bg-component-hover",
        "data-[disabled]:pointer-events-none data-[disabled]:text-ui-fg-disabled",
        className
      )}
      data-inset={inset}
      data-slot="context-menu-item"
      data-variant={variant}
      {...props}
    />
  );
}

function MenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "txt-compact-small relative flex cursor-pointer select-none items-center rounded-md bg-ui-bg-component py-1.5 pr-2 pl-[31px] text-ui-fg-base outline-none transition-colors",
        "focus:bg-ui-bg-component-hover focus-visible:bg-ui-bg-component-hover",
        "active:bg-ui-bg-component-hover",
        "data-[disabled]:pointer-events-none data-[disabled]:text-ui-fg-disabled",
        "data-[state=checked]:txt-compact-small-plus",
        className
      )}
      data-slot="context-menu-checkbox-item"
      {...props}
    >
      <span className="absolute left-2 flex size-[15px] items-center justify-center">
        <ContextMenuPrimitive.CheckboxItemIndicator>
          <RiCheckFill className="size-4" />
        </ContextMenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  );
}

function MenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioItem>) {
  return (
    <ContextMenuPrimitive.RadioItem
      className={cn(
        "txt-compact-small relative flex cursor-pointer select-none items-center rounded-md bg-ui-bg-component py-1.5 pr-2 pl-[31px] outline-none transition-colors",
        "focus:bg-ui-bg-component-hover focus-visible:bg-ui-bg-component-hover",
        "active:bg-ui-bg-component-hover",
        "data-[disabled]:pointer-events-none data-[disabled]:text-ui-fg-disabled",
        "data-[state=checked]:txt-compact-small-plus",
        className
      )}
      data-slot="context-menu-radio-item"
      {...props}
    >
      <span className="absolute left-2 flex size-[15px] items-center justify-center">
        <ContextMenuPrimitive.RadioItemIndicator>
          <RiCircleFill className="text-ui-fg-base" />
        </ContextMenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  );
}

function MenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.GroupLabel> & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.GroupLabel
      className={cn("txt-compact-xsmall-plus text-ui-fg-subtle", className)}
      data-inset={inset}
      data-slot="context-menu-label"
      {...props}
    />
  );
}

function MenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn("-mx-2 my-1 h-px bg-ui-fg-muted/10", className)}
      data-slot="context-menu-separator"
      {...props}
    />
  );
}

function MenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "txt-compact-small ml-auto text-ui-fg-subtle tracking-widest",
        className
      )}
      data-slot="context-menu-shortcut"
      {...props}
    />
  );
}

const ContextMenu = Object.assign(Menu, {
  Trigger: MenuTrigger,
  Group: MenuGroup,
  Portal: MenuPortal,
  Sub: MenuSub,
  RadioGroup: MenuRadioGroup,
  SubTrigger: MenuSubTrigger,
  SubContent: MenuSubContent,
  Content: MenuContent,
  Item: MenuItem,
  CheckboxItem: MenuCheckboxItem,
  RadioItem: MenuRadioItem,
  Label: MenuLabel,
  Separator: MenuSeparator,
  Shortcut: MenuShortcut,
});

export { ContextMenu };
