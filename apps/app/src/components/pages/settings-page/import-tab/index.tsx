import type { Id } from "@strand/backend/_generated/dataModel.js";
import { Heading } from "@strand/ui/heading";
import { Input } from "@strand/ui/input";
import { Text } from "@strand/ui/text";
import { useMemo, useState } from "react";
import { INTEGRATION_LOGO } from "./integration-logos";
import { JobList } from "./job-list";
import { SourceDialog } from "./source-dialog";
import type { UiImportSource } from "./sources";
import { UI_IMPORT_SOURCES } from "./sources";

export function ImportTab({ workspaceId }: { workspaceId: Id<"workspace"> }) {
  const [activeSource, setActiveSource] = useState<UiImportSource | null>(null);
  const [search, setSearch] = useState("");

  const filteredSources = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return UI_IMPORT_SOURCES;
    }
    return UI_IMPORT_SOURCES.filter(
      (source) =>
        source.label.toLowerCase().includes(query) ||
        source.description.toLowerCase().includes(query)
    );
  }, [search]);

  return (
    <div className="w-full">
      <div className="mb-6">
        <Heading>Import</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Bring in content from other tools. Items import without AI enrichment
          so large imports stay fast — run enrichment on selected items later.
        </Text>
      </div>

      <div className="mb-4">
        <Input
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search import sources"
          type="search"
          value={search}
        />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3">
        {filteredSources.length === 0 ? (
          <Text className="col-span-2 text-ui-fg-subtle" size="small">
            No import sources match your search.
          </Text>
        ) : (
          filteredSources.map((source) => {
            const Logo = INTEGRATION_LOGO[source.id];
            return (
              <button
                className="flex items-start gap-3 rounded-lg p-4 text-left transition-colors hover:bg-ui-bg-component"
                key={source.id}
                onClick={() => setActiveSource(source)}
                type="button"
              >
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-x-2.5">
                    {Logo && (
                      <Logo
                        aria-hidden="true"
                        className="mt-0.5 h-6 w-6 shrink-0"
                      />
                    )}
                    <Text className="font-medium">{source.label}</Text>
                  </div>
                  <Text className="font-medium text-ui-fg-muted" size="xsmall">
                    {source.description}
                  </Text>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="mb-3">
        <Heading>Recent imports</Heading>
      </div>
      <JobList workspaceId={workspaceId} />

      <SourceDialog
        onOpenChange={(next) => {
          if (!next) {
            setActiveSource(null);
          }
        }}
        open={activeSource !== null}
        source={activeSource}
        workspaceId={workspaceId}
      />
    </div>
  );
}
