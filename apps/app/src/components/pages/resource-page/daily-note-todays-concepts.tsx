import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Badge } from "@omi/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getBrowserTimeZone } from "~/lib/format";
import { CollapsibleSection } from "./collapsible-section";

interface ConceptItem {
  _id: Id<"concept">;
  name: string;
}

export function DailyNoteTodaysConcepts({
  date,
  workspaceId,
}: {
  date: string;
  workspaceId: Id<"workspace">;
}) {
  const { data } = useQuery(
    convexQuery(api.dailyNotes.queries.get, {
      workspaceId,
      date,
      timeZone: getBrowserTimeZone(),
    })
  );

  const concepts: ConceptItem[] = data?.todaysConcepts ?? [];
  if (concepts.length === 0) {
    return null;
  }

  return (
    <CollapsibleSection
      className="mt-12"
      id="daily-note-todays-concepts"
      secondary={
        <Badge className="font-mono" size="sm" variant="outline">
          {concepts.length}
        </Badge>
      }
      title="Today's concepts"
    >
      <div className="mt-2 flex flex-wrap gap-1.5 px-3">
        {concepts.map((concept) => (
          <Link
            key={concept._id}
            params={{ workspaceId }}
            // biome-ignore lint/suspicious/noExplicitAny: search route has no validateSearch; nuqs reads ?concepts=
            search={{ concepts: concept._id } as any}
            to="/workspace/$workspaceId/search"
          >
            <Badge
              className="cursor-pointer text-xs hover:bg-ui-bg-component-hover"
              variant="mono"
            >
              {concept.name}
            </Badge>
          </Link>
        ))}
      </div>
    </CollapsibleSection>
  );
}
