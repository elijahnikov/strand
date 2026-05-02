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
import { UserAvatar } from "~/components/common/user-avatar";
import { ResourceBadge, ResourceIcon } from "../../chat-page/resource-badge";

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

      const inner =
        kind === "user" ? (
          <UserMentionBadge label={props.label} userId={props.entityId} />
        ) : (
          <ResourceBadge
            resourceId={props.entityId}
            title={props.label}
            type={props.resourceType}
          />
        );

      return (
        <span contentEditable={false} draggable={false}>
          {inner}
        </span>
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
          {username}
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
    icon: (
      <ResourceIcon
        favicon={page.favicon}
        fileUrl={page.fileUrl}
        mimeType={page.mimeType}
        type={page.type}
      />
    ),
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
