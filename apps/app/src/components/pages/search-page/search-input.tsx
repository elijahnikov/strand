import { Input } from "@omi/ui/input";
import { useHotkey } from "@tanstack/react-hotkeys";
import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { DotGridLoader } from "~/components/common/dot-grid-loader";

export function SearchInput({
  value,
  onChange,
  isPending,
}: {
  value: string;
  onChange: (next: string) => void;
  isPending: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, []);

  useHotkey(
    "/",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    },
    { ignoreInputs: true }
  );

  return (
    <div className="relative w-48 md:w-72">
      <div className="pointer-events-none absolute top-0 bottom-0 left-0 flex size-8 items-center justify-center text-ui-fg-muted">
        {isPending ? <DotGridLoader /> : <SearchIcon className="size-4" />}
      </div>
      <Input
        className="rounded-full bg-ui-bg-base-hover pr-8 pl-8"
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search your library…"
        ref={inputRef}
        type="search"
        value={value}
      />
      {value ? (
        <button
          aria-label="Clear search"
          className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-ui-fg-muted transition-colors hover:bg-ui-bg-component hover:text-ui-fg-base"
          onClick={() => onChange("")}
          type="button"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
