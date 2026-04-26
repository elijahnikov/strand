import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Input } from "@omi/ui/input";
import { useNavigate } from "@tanstack/react-router";
import { SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";

export function HomeSearchBox({
  workspaceId,
}: {
  workspaceId: Id<"workspace">;
}) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    navigate({
      to: "/workspace/$workspaceId/search",
      params: { workspaceId },
      search: { q: trimmed },
    });
  };

  return (
    <form className="mx-auto mb-14 flex w-full" onSubmit={handleSubmit}>
      <div className="relative mx-auto w-full">
        <div className="pointer-events-none absolute top-0 bottom-0 left-0 flex size-8 items-center justify-center text-ui-fg-muted">
          <SearchIcon className="size-4" />
        </div>
        <Input
          className="rounded-full bg-ui-bg-field-component-hover pr-8 pl-8 hover:bg-ui-bg-component-hover dark:bg-ui-bg-field-component dark:hover:bg-ui-bg-field-component-hover"
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search your library…"
          type="search"
          value={value}
        />
        {value ? (
          <button
            aria-label="Clear search"
            className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-ui-fg-muted transition-colors hover:bg-ui-bg-component hover:text-ui-fg-base"
            onClick={() => setValue("")}
            type="button"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>
    </form>
  );
}
