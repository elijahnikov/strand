import { cn } from "@omi/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@omi/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@omi/ui/tabs";
import { Text } from "@omi/ui/text";
import { EmojiPicker } from "frimousse";
import { useState } from "react";
import { workspaceIcons } from "~/lib/workspace-icons";
import { WorkspaceIcon } from "./workspace-icon";

const ICON_COLORS = [
  { name: "gray", value: "#6B7280" },
  { name: "red", value: "#EF4444" },
  { name: "orange", value: "#F97316" },
  { name: "green", value: "#22C55E" },
  { name: "blue", value: "#3B82F6" },
  { name: "purple", value: "#8B5CF6" },
] as const;

type IconSelection =
  | { type: "icon"; name: string; color: string }
  | { type: "emoji"; emoji: string };

interface WorkspaceIconSelectorProps {
  children: React.ReactNode;
  currentEmoji?: string;
  currentIcon?: string;
  currentIconColor?: string;
  onSelect: (value: IconSelection) => void;
}

export function WorkspaceIconSelector({
  currentIcon,
  currentIconColor,
  currentEmoji,
  onSelect,
  children,
}: WorkspaceIconSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(
    currentIconColor || ICON_COLORS[0].value
  );

  const handleIconSelect = (name: string) => {
    onSelect({ type: "icon", name, color: selectedColor });
    setOpen(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    onSelect({ type: "emoji", emoji });
    setOpen(false);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger render={<button type="button" />}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[280px] bg-ui-bg-component p-0"
        sideOffset={8}
      >
        <Tabs defaultValue={currentEmoji ? "emojis" : "icons"}>
          <TabsList className="mb-0 h-10 w-full rounded-b-none border-b px-1.25 pb-0.5">
            <TabsTrigger className="h-7! grow" value="icons">
              <Text size="small">Icons</Text>
            </TabsTrigger>
            <TabsTrigger className="h-7! grow" value="emojis">
              <Text size="small">Emojis</Text>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="icons">
            <div className="-mt-2 p-2">
              <div className="mb-2 grid grid-cols-6">
                {ICON_COLORS.map((color) => (
                  <button
                    className="mx-auto flex size-7 items-center justify-center rounded-full transition-transform hover:scale-110"
                    key={color.name}
                    onClick={() => setSelectedColor(color.value)}
                    style={{
                      outline:
                        selectedColor === color.value
                          ? `2px solid ${color.value}`
                          : "2px solid transparent",
                    }}
                    type="button"
                  >
                    <span
                      className="size-5 rounded-full"
                      style={{ backgroundColor: color.value }}
                    />
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-6">
                {workspaceIcons.map((item) => {
                  const isSelected = !currentEmoji && currentIcon === item.name;
                  return (
                    <button
                      className="relative mx-auto flex size-8 items-center justify-center rounded-md transition-colors hover:bg-ui-bg-subtle-hover data-[selected=true]:bg-ui-bg-subtle"
                      data-selected={isSelected}
                      key={item.name}
                      onClick={() => handleIconSelect(item.name)}
                      type="button"
                    >
                      <WorkspaceIcon
                        icon={item.name}
                        iconColor={selectedColor}
                        size="sm"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="emojis">
            <EmojiPicker.Root
              className="flex h-[280px] flex-col px-2"
              columns={6}
              onEmojiSelect={(emoji) => handleEmojiSelect(emoji.emoji)}
            >
              <EmojiPicker.Search
                autoFocus
                className={cn(
                  "relative mb-1 w-full appearance-none rounded-lg bg-ui-bg-field-component text-ui-fg-base placeholder-ui-fg-muted caret-ui-fg-base shadow-borders-base outline-none transition-fg hover:bg-ui-bg-field-component-hover",
                  "focus-visible:shadow-borders-interactive-with-active",
                  "disabled:cursor-not-allowed disabled:bg-ui-bg-disabled! disabled:text-ui-fg-disabled disabled:placeholder-ui-fg-disabled",
                  "invalid:shadow-borders-error! aria-invalid:shadow-borders-error!",
                  "txt-compact-medium h-8 px-2 py-1.5"
                )}
                placeholder="Search emoji..."
              />
              <EmojiPicker.Viewport className="no-scrollbar relative flex-1 outline-hidden">
                <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-ui-fg-muted">
                  Loading…
                </EmojiPicker.Loading>
                <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-ui-fg-muted">
                  No emoji found
                </EmojiPicker.Empty>
                <EmojiPicker.List
                  className="no-scrollbar w-full select-none pb-1.5"
                  components={{
                    CategoryHeader: ({ category, ...props }) => (
                      <div
                        className="bg-ui-bg-component px-1 pt-2 pb-1.5 font-medium text-ui-fg-muted text-xs"
                        {...props}
                      >
                        {category.label}
                      </div>
                    ),
                    Row: ({ children, ...props }) => (
                      <div className="scroll-my-1.5" {...props}>
                        {children}
                      </div>
                    ),
                    Emoji: ({ emoji, ...props }) => (
                      <button
                        className="flex aspect-square w-[calc(100%/6)] items-center justify-center rounded-md text-base transition-colors hover:bg-ui-bg-subtle-hover"
                        data-active={emoji.isActive || undefined}
                        type="button"
                        {...props}
                      >
                        {emoji.emoji}
                      </button>
                    ),
                  }}
                />
              </EmojiPicker.Viewport>
            </EmojiPicker.Root>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
