import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Text } from "@omi/ui/text";
import { CollapsibleSection } from "~/components/common/collapsible-section";
import {
  type ConceptCluster,
  ConceptClusterCard,
} from "./concept-cluster-card";
import { ForgottenGemCard } from "./forgotten-gem-card";
import {
  type RecentConnection,
  RecentConnectionCard,
} from "./recent-connection-card";
import type { ResourceTileData } from "./resource-tile";
import { UpgradeNudgeCard } from "./upgrade-nudge-card";

export interface HomeAI {
  conceptClusters: ConceptCluster[];
  forgottenGems: ResourceTileData[];
  recentConnections: RecentConnection[];
}

export function AISection({
  workspaceId,
  ai,
}: {
  workspaceId: Id<"workspace">;
  ai: HomeAI | null;
}) {
  if (!ai) {
    return (
      <CollapsibleSection className="mb-8" title="AI insights">
        <div className="mt-3">
          <UpgradeNudgeCard />
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <div className="flex flex-col gap-14">
      <ConceptsSection
        clusters={ai.conceptClusters}
        workspaceId={workspaceId}
      />
      <RecentConnectionsSection
        connections={ai.recentConnections}
        workspaceId={workspaceId}
      />
      {ai.forgottenGems.length > 0 ? (
        <ForgottenGemsSection
          gems={ai.forgottenGems}
          workspaceId={workspaceId}
        />
      ) : null}
    </div>
  );
}

function ConceptsSection({
  workspaceId,
  clusters,
}: {
  workspaceId: Id<"workspace">;
  clusters: ConceptCluster[];
}) {
  return (
    <CollapsibleSection title="Concepts">
      <div className="mt-3">
        {clusters.length === 0 ? (
          <EmptyAICard message="Save a few more resources on the same topic and clusters will show up here." />
        ) : (
          <div className="flex flex-col gap-y-4">
            {clusters.map((c) => (
              <ConceptClusterCard
                cluster={c}
                key={c.conceptId}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function RecentConnectionsSection({
  workspaceId,
  connections,
}: {
  workspaceId: Id<"workspace">;
  connections: RecentConnection[];
}) {
  return (
    <CollapsibleSection title="Recent connections">
      <div className="mt-3">
        {connections.length === 0 ? (
          <EmptyAICard message="When new saves connect to older items in your library, they'll appear here." />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {connections.map((c) => (
              <RecentConnectionCard
                connection={c}
                key={c.linkId}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function ForgottenGemsSection({
  workspaceId,
  gems,
}: {
  workspaceId: Id<"workspace">;
  gems: ResourceTileData[];
}) {
  return (
    <CollapsibleSection title="Worth revisiting">
      <div className="mt-3">
        {gems.length === 0 ? (
          <EmptyAICard message="As your library grows, older resources you might want to revisit will surface here." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gems.map((r) => (
              <ForgottenGemCard
                key={r._id}
                resource={r}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function EmptyAICard({ message }: { message: string }) {
  return (
    <div>
      <Text className="font-medium text-ui-fg-muted" size="xsmall">
        {message}
      </Text>
    </div>
  );
}
