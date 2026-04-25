import {
  Action,
  ActionPanel,
  Color,
  Grid,
  Icon,
  LaunchType,
  launchCommand,
  showToast,
  Toast,
} from "@raycast/api";
import { showFailureToast, useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import { api } from "~/lib/api";
import { NotConnectedError } from "~/lib/auth";
import type { ResourceItem } from "~/lib/types";

const ICON_BY_TYPE: Record<ResourceItem["type"], Icon> = {
  website: Icon.Globe,
  note: Icon.Document,
  file: Icon.Image,
};

const TYPE_LABEL: Record<ResourceItem["type"], string> = {
  website: "Website",
  note: "Note",
  file: "File",
};

function getSubtitle(item: ResourceItem): string {
  if (item.type === "website") {
    return item.domain ?? "";
  }
  if (item.type === "file") {
    return item.fileName ?? "";
  }
  if (item.type === "note") {
    return item.snippet ?? "";
  }
  return "";
}

function getContent(item: ResourceItem): Grid.Item.Props["content"] {
  if (item.type !== "note" && item.previewUrl) {
    return item.previewUrl;
  }
  return { source: ICON_BY_TYPE[item.type], tintColor: Color.SecondaryText };
}

function getOpenUrl(item: ResourceItem): string | null {
  if (item.type === "website" && item.url) {
    return item.url;
  }
  if (item.type === "file" && item.previewUrl) {
    return item.previewUrl;
  }
  return null;
}

function ItemActions({ item }: { item: ResourceItem }) {
  const openUrl = getOpenUrl(item);
  return (
    <ActionPanel>
      {openUrl ? <Action.OpenInBrowser title="Open" url={openUrl} /> : null}
      <Action.CopyToClipboard
        content={item.title}
        shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
        title="Copy Title"
      />
      {openUrl ? (
        <Action.CopyToClipboard
          content={openUrl}
          shortcut={{ modifiers: ["cmd"], key: "." }}
          title="Copy URL"
        />
      ) : null}
      {openUrl ? (
        <Action.CopyToClipboard
          content={`[${item.title}](${openUrl})`}
          shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}
          title="Copy as Markdown Link"
        />
      ) : null}
    </ActionPanel>
  );
}

function NotConnectedActions() {
  return (
    <ActionPanel>
      <Action
        icon={Icon.Link}
        onAction={async () => {
          try {
            await launchCommand({
              name: "connect",
              type: LaunchType.UserInitiated,
            });
          } catch (err) {
            await showFailureToast(err, { title: "Could not open connect" });
          }
        }}
        title="Connect Omi"
      />
    </ActionPanel>
  );
}

export default function SearchResources() {
  const [searchText, setSearchText] = useState("");

  const { data, isLoading, error, pagination } = useCachedPromise(
    (search: string) => async (options: { page: number; cursor?: string }) => {
      const result = await api.listResources({
        search: search || undefined,
        cursor: options.cursor,
        limit: 30,
      });
      return {
        data: result.items,
        hasMore: !result.isDone,
        cursor: result.cursor ?? undefined,
      };
    },
    [searchText],
    {
      keepPreviousData: true,
      onError: (err) => {
        if (err instanceof NotConnectedError) {
          return;
        }
        void showToast({
          style: Toast.Style.Failure,
          title: "Failed to load",
          message: err.message,
        });
      },
    }
  );

  const notConnected = error instanceof NotConnectedError;

  if (notConnected) {
    return (
      <Grid>
        <Grid.EmptyView
          actions={<NotConnectedActions />}
          description="Run Connect Omi to link your account."
          icon={Icon.Link}
          title="Raycast isn’t connected to omi"
        />
      </Grid>
    );
  }

  return (
    <Grid
      aspectRatio="3/2"
      columns={5}
      fit={Grid.Fit.Fill}
      inset={Grid.Inset.Small}
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      pagination={pagination}
      searchBarPlaceholder="Search your omi resources"
      throttle
    >
      {(data ?? []).map((item) => (
        <Grid.Item
          actions={<ItemActions item={item} />}
          content={getContent(item)}
          key={item._id}
          subtitle={getSubtitle(item)}
          title={item.title || TYPE_LABEL[item.type]}
        />
      ))}
    </Grid>
  );
}
