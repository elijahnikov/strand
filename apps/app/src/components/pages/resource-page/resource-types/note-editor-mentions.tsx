import type {
  BlockNoteEditor,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core";
import {
  createReactInlineContentSpec,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Badge } from "@omi/ui/badge";
import type { QueryClient } from "@tanstack/react-query";
import { FileTextIcon, GlobeIcon } from "lucide-react";
import { FileKindIcon } from "~/components/common/file-kind-icon";
import { UserAvatar } from "~/components/common/user-avatar";
import { ResourceBadge } from "../../chat-page/resource-badge";

type ResourceType = "website" | "note" | "file";

export const Mention = createReactInlineContentSpec(
  {
    type: "mention",
    propSchema: {
      kind: { default: "page" as const },
      entityId: { default: "" as string },
      label: { default: "" as string },
      workspaceId: { default: "" as string },
      resourceType: { default: "" as string },
    },
    content: "none",
  },
  {
    render: ({ inlineContent }) => {
      const props = inlineContent.props;
      const kind = props.kind === "user" ? "user" : "page";

      if (kind === "user") {
        return <UserMentionBadge label={props.label} userId={props.entityId} />;
      }

      return (
        <ResourceBadge
          resourceId={props.entityId}
          title={props.label}
          type={props.resourceType}
        />
      );
    },
  }
);

function UserMentionBadge({
  userId,
  label,
}: {
  userId: string;
  label: string;
}) {
  const { data: user } = useQueryUser(userId);
  const username = user?.username ?? label;
  const image = user?.image;

  return (
    <span className="inline-flex max-w-full -translate-y-[2px] align-middle">
      <Badge className="w-full max-w-full" variant="mono">
        <UserAvatar
          className="size-3.5 shrink-0"
          image={image}
          name={username}
          size={14}
        />
        <span className="min-w-0 truncate font-medium font-sans! text-xs">
          @{username}
        </span>
      </Badge>
    </span>
  );
}

function useQueryUser(_userId: string) {
  // Light-weight wrapper so we can swap the data source later.
  // Today we don't have a public-by-id user query, so just return the label.
  return {
    data: undefined as { username: string; image?: string } | undefined,
  };
}

interface MentionPickerArgs {
  // biome-ignore lint/suspicious/noExplicitAny: BlockNote editor type is too narrow to express the project schema here
  editor: BlockNoteEditor<any, InlineContentSchema, StyleSchema>;
  query: string;
  queryClient: QueryClient;
  workspaceId: Id<"workspace">;
}

export async function getMentionItems({
  query,
  queryClient,
  workspaceId,
  editor,
}: MentionPickerArgs): Promise<DefaultReactSuggestionItem[]> {
  const trimmed = query.trim();
  const [pages, people] = await Promise.all([
    queryClient.fetchQuery(
      convexQuery(api.chat.queries.searchResources, {
        workspaceId,
        query: trimmed,
        limit: 5,
      })
    ),
    queryClient.fetchQuery(
      convexQuery(api.workspace.queries.searchMembers, {
        workspaceId,
        query: trimmed,
        limit: 5,
      })
    ),
  ]);

  const peopleItems: DefaultReactSuggestionItem[] = people.map((person) => ({
    title: person.username,
    subtext: person.email,
    group: "People",
    icon: (
      <UserAvatar
        className="size-4"
        image={person.image}
        name={person.username}
        size={16}
      />
    ),
    onItemClick: () => {
      insertMention(editor, {
        kind: "user",
        entityId: person._id,
        label: person.username,
      });
    },
  }));

  const pageItems: DefaultReactSuggestionItem[] = pages.map((page) => ({
    title: page.title,
    group: "Pages",
    icon: <PageItemIcon page={page} />,
    onItemClick: () => {
      insertMention(editor, {
        kind: "page",
        entityId: page._id,
        label: page.title,
        workspaceId,
        resourceType: page.type,
      });
    },
  }));

  return [...peopleItems, ...pageItems];
}

function PageItemIcon({
  page,
}: {
  page: {
    type: ResourceType;
    favicon: string | null;
    fileUrl: string | null;
    mimeType: string | null;
  };
}) {
  if (page.type === "website" && page.favicon) {
    return (
      <img
        alt=""
        className="size-4 rounded-[2px]"
        height={16}
        src={page.favicon}
        width={16}
      />
    );
  }
  if (page.type === "website") {
    return <GlobeIcon className="size-4 text-ui-fg-muted" />;
  }
  if (page.type === "file") {
    return (
      <FileKindIcon
        className="size-4 text-ui-fg-muted"
        fileName={undefined}
        mimeType={page.mimeType ?? undefined}
      />
    );
  }
  return <FileTextIcon className="size-4 text-ui-fg-muted" />;
}

function insertMention(
  // biome-ignore lint/suspicious/noExplicitAny: see MentionPickerArgs
  editor: BlockNoteEditor<any, InlineContentSchema, StyleSchema>,
  props: {
    kind: "user" | "page";
    entityId: string;
    label: string;
    workspaceId?: string;
    resourceType?: string;
  }
) {
  editor.insertInlineContent([
    {
      type: "mention",
      props: {
        kind: props.kind,
        entityId: props.entityId,
        label: props.label,
        workspaceId: props.workspaceId ?? "",
        resourceType: props.resourceType ?? "",
      },
    },
    " ",
  ] as never);
}
