import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import {
  RiBookmark2Fill,
  RiChat1Fill,
  RiFileTextLine,
  RiGlobalLine,
  RiHashtag,
  RiHome2Fill,
  RiSearch2Fill,
  RiSettings5Fill,
  RiStickyNoteLine,
  RiUploadCloud2Line,
} from "@remixicon/react";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
} from "@omi/ui/command";
import { Skeleton } from "@omi/ui/skeleton";
import { toastManager } from "@omi/ui/toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  type ClipboardEvent,
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FileKindIcon } from "~/components/common/file-kind-icon";
import { isHttpUrl } from "~/lib/is-http-url";
import { MAX_FILE_SIZE, uploadFile } from "~/lib/upload-file";

const SEARCH_DEBOUNCE_MS = 150;
const SEARCH_RESULT_LIMIT = 8;
const QUERY_TITLE_MAX = 80;

interface Item {
  action: () => void;
  icon?: ReactNode;
  label: string;
  value: string;
}

interface ResourceIconSource {
  favicon?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
  type: string;
}

interface Group {
  items: Item[];
  value: string;
}

export function CommandPalette({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: Id<"workspace">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  const attachScrollObserver = useCallback(
    (container: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!container) {
        return;
      }
      const viewport = container.closest<HTMLElement>(
        "[data-slot=scroll-area-viewport]"
      );
      if (!viewport) {
        return;
      }
      const scrollHighlighted = () => {
        const highlighted =
          container.querySelector<HTMLElement>("[data-highlighted]");
        if (!highlighted) {
          return;
        }
        const itemRect = highlighted.getBoundingClientRect();
        const vpRect = viewport.getBoundingClientRect();
        if (itemRect.bottom > vpRect.bottom) {
          viewport.scrollTop += itemRect.bottom - vpRect.bottom + 12;
        } else if (itemRect.top < vpRect.top) {
          viewport.scrollTop -= vpRect.top - itemRect.top + 12;
        }
      };
      const observer = new MutationObserver(scrollHighlighted);
      observer.observe(container, {
        attributes: true,
        attributeFilter: ["data-highlighted"],
        subtree: true,
      });
      observerRef.current = observer;
    },
    []
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const { mutate: createResourceMutate, mutateAsync: createResourceAsync } =
    useMutation({
      mutationFn: useConvexMutation(api.resource.mutations.create),
      meta: { customErrorToast: true },
    });

  const { mutateAsync: generateUploadUrl } = useMutation({
    mutationFn: useConvexMutation(api.resource.mutations.generateUploadUrl),
  });

  const { data: recent, isPending: recentPending } = useQuery(
    convexQuery(
      api.resource.queries.listRecent,
      open ? { workspaceId, limit: 5 } : "skip"
    )
  );

  const trimmedQuery = debouncedQuery.trim();
  const queryIsStale = trimmedQuery !== query.trim();
  const { data: searchResults, isPending: searchPending } = useQuery(
    convexQuery(
      api.chat.queries.searchResources,
      open && trimmedQuery
        ? { workspaceId, query: trimmedQuery, limit: SEARCH_RESULT_LIMIT }
        : "skip"
    )
  );
  const searchLoading =
    !!query.trim() && (queryIsStale || (!!trimmedQuery && searchPending));

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const goTo = useCallback(
    (path: string) => {
      navigate({ to: path });
      close();
    },
    [navigate, close]
  );

  const handleNewNote = useCallback(async () => {
    try {
      const resourceId = await createResourceAsync({
        workspaceId,
        type: "note",
        title: "Untitled",
        plainTextContent: "",
      });
      close();
      if (resourceId) {
        navigate({
          to: "/workspace/$workspaceId/resource/$resourceId",
          params: { workspaceId, resourceId },
        });
      }
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Could not create note",
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, [createResourceAsync, workspaceId, close, navigate]);

  const handleCreateNoteFromQuery = useCallback(
    async (text: string) => {
      try {
        const title = text.slice(0, QUERY_TITLE_MAX) || "Untitled";
        const resourceId = await createResourceAsync({
          workspaceId,
          type: "note",
          title,
          plainTextContent: text,
        });
        close();
        if (resourceId) {
          navigate({
            to: "/workspace/$workspaceId/resource/$resourceId",
            params: { workspaceId, resourceId },
          });
        }
      } catch (err) {
        toastManager.add({
          type: "error",
          title: "Could not create note",
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [createResourceAsync, workspaceId, close, navigate]
  );

  const handleSaveUrl = useCallback(
    (url: string) => {
      createResourceMutate({
        workspaceId,
        type: "website",
        title: url,
        url,
      });
      toastManager.add({ type: "success", title: "Saved website" });
      close();
    },
    [createResourceMutate, workspaceId, close]
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      const valid = files.filter((f) => f.size <= MAX_FILE_SIZE);
      if (valid.length < files.length) {
        toastManager.add({
          type: "error",
          title: "Files over 50MB are not supported",
        });
      }
      if (valid.length === 0) {
        return;
      }
      close();
      await Promise.all(
        valid.map((file) =>
          uploadFile({
            file,
            workspaceId,
            generateUploadUrl: () => generateUploadUrl({}) as Promise<string>,
            createResource: createResourceMutate,
          }).catch((err) => {
            toastManager.add({
              type: "error",
              title: `Upload failed: ${file.name}`,
              description: err instanceof Error ? err.message : String(err),
            });
          })
        )
      );
      toastManager.add({
        type: "success",
        title:
          valid.length === 1
            ? "Uploaded file"
            : `Uploaded ${valid.length} files`,
      });
    },
    [workspaceId, generateUploadUrl, createResourceMutate, close]
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      const data = event.clipboardData;
      if (!data) {
        return;
      }
      if (data.files.length > 0) {
        event.preventDefault();
        void handleFiles(Array.from(data.files));
        return;
      }
      const text = data.getData("text/plain").trim();
      if (text && isHttpUrl(text)) {
        event.preventDefault();
        handleSaveUrl(text);
      }
    },
    [handleFiles, handleSaveUrl]
  );

  const base = `/workspace/${workspaceId}`;

  const queryIsUrl = trimmedQuery.length > 0 && isHttpUrl(trimmedQuery);

  const actionItems: Item[] = [
    {
      value: "new-note",
      label: "New empty note",
      icon: <RiFileTextLine className="size-4 text-ui-fg-muted" />,
      action: () => void handleNewNote(),
    },
    {
      value: "upload-file",
      label: "Upload a file",
      icon: <RiUploadCloud2Line className="size-4 text-ui-fg-muted" />,
      action: handleUploadClick,
    },
    ...(queryIsUrl
      ? [
          {
            value: "save-url",
            label: `Save as website: ${trimmedQuery}`,
            icon: <RiGlobalLine className="size-4 text-ui-fg-muted" />,
            action: () => handleSaveUrl(trimmedQuery),
          } as Item,
        ]
      : []),
    ...(trimmedQuery && !queryIsUrl
      ? [
          {
            value: "create-note-from-query",
            label: `Create note: "${trimmedQuery}"`,
            icon: <RiFileTextLine className="size-4 text-ui-fg-muted" />,
            action: () => void handleCreateNoteFromQuery(trimmedQuery),
          } as Item,
        ]
      : []),
  ];

  const navigationItems: Item[] = [
    {
      value: "go-home",
      label: "Home",
      icon: <RiHome2Fill className="size-4 text-ui-fg-muted" />,
      action: () => goTo(base),
    },
    {
      value: "go-library",
      label: "Library",
      icon: <RiBookmark2Fill className="size-4 text-ui-fg-muted" />,
      action: () => goTo(`${base}/library`),
    },
    {
      value: "go-search",
      label: "Search",
      icon: <RiSearch2Fill className="size-4 text-ui-fg-muted" />,
      action: () => goTo(`${base}/search`),
    },
    {
      value: "go-chat",
      label: "Chat",
      icon: <RiChat1Fill className="size-4 text-ui-fg-muted" />,
      action: () => goTo(`${base}/chat`),
    },
    {
      value: "go-tags",
      label: "Tags",
      icon: <RiHashtag className="size-4 text-ui-fg-muted" />,
      action: () => goTo(`${base}/tags`),
    },
    {
      value: "go-settings",
      label: "Settings",
      icon: <RiSettings5Fill className="size-4 text-ui-fg-muted" />,
      action: () => goTo(`${base}/settings`),
    },
  ];

  const searchItems: Item[] =
    trimmedQuery && searchResults
      ? searchResults.map((result) => ({
          value: `result-${result._id}`,
          label: result.title,
          icon: (
            <CommandResourceIcon
              favicon={result.favicon}
              fileUrl={result.fileUrl}
              mimeType={result.mimeType}
              type={result.type}
            />
          ),
          action: () => goTo(`${base}/resource/${result._id}`),
        }))
      : [];

  const recentItems: Item[] =
    !trimmedQuery && recent
      ? recent.map((resource) => {
          const iconSource: ResourceIconSource = { type: resource.type };
          if ("website" in resource) {
            iconSource.favicon = resource.website?.favicon ?? null;
          } else if ("file" in resource) {
            iconSource.mimeType = resource.file?.mimeType ?? null;
            iconSource.fileUrl =
              "fileUrl" in resource ? (resource.fileUrl ?? null) : null;
          }
          return {
            value: `recent-${resource._id}`,
            label: resource.title,
            icon: <CommandResourceIcon {...iconSource} />,
            action: () => goTo(`${base}/resource/${resource._id}`),
          };
        })
      : [];

  const groupedItems: Group[] = [
    ...(searchItems.length > 0
      ? [{ value: "Resources", items: searchItems }]
      : []),
    { value: "Actions", items: actionItems },
    { value: "Navigate", items: navigationItems },
    ...(recentItems.length > 0
      ? [{ value: "Recent", items: recentItems }]
      : []),
  ];

  function handleItemClick(item: Item) {
    item.action();
  }

  return (
    <>
      <CommandDialog onOpenChange={onOpenChange} open={open}>
        <CommandDialogPopup className="max-h-[min(600px,80vh)]!">
          <Command items={groupedItems} onValueChange={setQuery} value={query}>
            <CommandPanel className="overflow-y-scroll **:data-[slot=scroll-area-viewport]:max-h-[min(450px,65vh)] **:data-[slot=scroll-area-viewport]:[--fade-size:0px]">
              <CommandInput
                className="text-sm"
                onPaste={handlePaste}
                placeholder="Search, navigate, paste a URL, or create…"
              />
              <CommandEmpty>No results found.</CommandEmpty>
              {searchLoading ? (
                <div className="px-2 pt-2">
                  <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">
                    Resources
                  </div>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonRow key={`search-skel-${i}`} />
                  ))}
                </div>
              ) : null}
              <CommandList
                className="overflow-x-hidden px-0! pt-2! pb-2!"
                ref={attachScrollObserver}
              >
                {(group: Group) => (
                  <Fragment key={group.value}>
                    <CommandGroup className="px-2" items={group.items}>
                      <CommandGroupLabel>{group.value}</CommandGroupLabel>
                      <CommandCollection>
                        {(item: Item) => (
                          <CommandItem
                            className="flex items-center gap-x-2"
                            key={item.value}
                            onClick={() => handleItemClick(item)}
                            value={item.value}
                          >
                            {item.icon ? (
                              <span className="flex size-4 shrink-0 items-center justify-center">
                                {item.icon}
                              </span>
                            ) : null}
                            <span className="flex-1 truncate text-[13px]">
                              {item.label}
                            </span>
                          </CommandItem>
                        )}
                      </CommandCollection>
                    </CommandGroup>
                    <CommandSeparator className="-mx-1" />
                  </Fragment>
                )}
              </CommandList>
              {!trimmedQuery && recentPending ? (
                <div className="px-2 pb-2">
                  <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">
                    Recent
                  </div>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={`recent-skel-${i}`} />
                  ))}
                </div>
              ) : null}
            </CommandPanel>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>
      <input
        accept="*/*"
        className="hidden"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) {
            void handleFiles(files);
          }
        }}
        ref={fileInputRef}
        type="file"
      />
    </>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-x-2 px-2 py-1.5">
      <Skeleton className="size-4 shrink-0" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

function CommandResourceIcon({
  type,
  favicon,
  fileUrl,
  mimeType,
}: ResourceIconSource) {
  if (type === "website") {
    if (favicon) {
      return (
        <img
          alt=""
          className="size-4 shrink-0 rounded-[3px]"
          height={16}
          src={favicon}
          width={16}
        />
      );
    }
    return <RiGlobalLine className="size-4 shrink-0 text-ui-fg-muted" />;
  }
  if (type === "note") {
    return <RiStickyNoteLine className="size-4 shrink-0 text-ui-fg-muted" />;
  }
  if (type === "file") {
    if (mimeType?.startsWith("image/") && fileUrl) {
      return (
        <img
          alt=""
          className="size-4 shrink-0 rounded-[2px] object-cover"
          height={16}
          src={fileUrl}
          width={16}
        />
      );
    }
    return <FileKindIcon className="size-4 shrink-0" mimeType={mimeType} />;
  }
  return <RiBookmark2Fill className="size-4 shrink-0 text-ui-fg-muted" />;
}
