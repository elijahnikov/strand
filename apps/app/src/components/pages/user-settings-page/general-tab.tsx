import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { Button } from "@omi/ui/button";
import { Heading } from "@omi/ui/heading";
import { Input } from "@omi/ui/input";
import { LoadingButton } from "@omi/ui/loading-button";
import { Text } from "@omi/ui/text";
import { toastManager } from "@omi/ui/toast";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import BoringAvatar from "boring-avatars";
import { ConvexError } from "convex/values";
import { type ChangeEvent, useEffect, useRef, useState } from "react";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function getErrorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    return typeof error.data === "string" ? error.data : "An error occurred";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An error occurred";
}

type PendingAvatar =
  | { kind: "upload"; file: File; previewUrl: string }
  | { kind: "remove" };

export function GeneralTab() {
  const { data } = useSuspenseQuery(
    convexQuery(api.user.queries.currentUser, {})
  );
  const user = data.user;

  const [username, setUsername] = useState(user?.username ?? "");
  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatar | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (pendingAvatar?.kind === "upload") {
        URL.revokeObjectURL(pendingAvatar.previewUrl);
      }
    };
  }, [pendingAvatar]);

  const { mutateAsync: updateProfile, isPending: savingProfile } = useMutation({
    mutationFn: useConvexMutation(api.user.mutations.updateProfile),
  });

  const { mutateAsync: generateAvatarUploadUrl } = useMutation({
    mutationFn: useConvexMutation(api.user.mutations.generateAvatarUploadUrl),
  });

  const { mutateAsync: setAvatarFromStorage } = useMutation({
    mutationFn: useConvexMutation(api.user.mutations.setAvatarFromStorage),
  });

  if (!user) {
    return null;
  }

  const handleAvatarSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (!file) {
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toastManager.add({
        type: "error",
        title: "Image must be 5MB or smaller",
      });
      return;
    }
    setPendingAvatar((prev) => {
      if (prev?.kind === "upload") {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return {
        kind: "upload",
        file,
        previewUrl: URL.createObjectURL(file),
      };
    });
  };

  const handleRemoveAvatar = () => {
    setPendingAvatar((prev) => {
      if (prev?.kind === "upload") {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return { kind: "remove" };
    });
  };

  const usernameDirty = username.trim() !== user.username;
  const dirty = usernameDirty || pendingAvatar !== null;

  const displayedAvatarUrl =
    pendingAvatar?.kind === "upload"
      ? pendingAvatar.previewUrl
      : pendingAvatar?.kind === "remove"
        ? undefined
        : user.image;

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (pendingAvatar?.kind === "upload") {
        const uploadUrl = await generateAvatarUploadUrl({});
        const response = await fetch(uploadUrl as unknown as string, {
          method: "POST",
          headers: { "Content-Type": pendingAvatar.file.type },
          body: pendingAvatar.file,
        });
        if (!response.ok) {
          throw new Error("Upload failed");
        }
        const { storageId } = (await response.json()) as {
          storageId: Id<"_storage">;
        };
        await setAvatarFromStorage({ storageId });
      } else if (pendingAvatar?.kind === "remove") {
        await updateProfile({ image: null });
      }

      if (usernameDirty) {
        await updateProfile({ username });
      }

      setPendingAvatar((prev) => {
        if (prev?.kind === "upload") {
          URL.revokeObjectURL(prev.previewUrl);
        }
        return null;
      });
      toastManager.add({ type: "success", title: "Profile updated" });
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Could not update profile",
        description: getErrorMessage(err),
      });
    }
  };

  return (
    <form className="w-full" onSubmit={handleSubmit}>
      <div className="mb-6">
        <Heading>General</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          Edit your profile. Changes apply across all your workspaces.
        </Text>
      </div>

      <div className="mb-8 flex items-center gap-4">
        <div
          className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ui-bg-subtle"
          style={{
            width: 64,
            height: 64,
            minWidth: 64,
            minHeight: 64,
            maxWidth: 64,
            maxHeight: 64,
          }}
        >
          {displayedAvatarUrl ? (
            <img
              alt={user.username}
              height={64}
              src={displayedAvatarUrl}
              style={{
                width: 64,
                height: 64,
                maxWidth: 64,
                maxHeight: 64,
                objectFit: "cover",
                display: "block",
              }}
              width={64}
            />
          ) : (
            <BoringAvatar name={user.username} size={64} variant="marble" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              size="small"
              type="button"
              variant="secondary"
            >
              Choose image
            </Button>
            {displayedAvatarUrl && (
              <Button
                onClick={handleRemoveAvatar}
                size="small"
                type="button"
                variant="secondary"
              >
                Remove
              </Button>
            )}
          </div>
          <Text className="text-ui-fg-muted" size="xsmall">
            PNG, JPG, or WebP up to 5MB.
          </Text>
        </div>
        <input
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleAvatarSelect}
          ref={fileInputRef}
          type="file"
        />
      </div>

      <div className="mb-6 max-w-md">
        <Text className="mb-1.5" size="small">
          Username
        </Text>
        <Input
          autoComplete="off"
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          value={username}
        />
        <Text className="mt-2 text-ui-fg-muted" size="xsmall">
          2-32 characters. Letters, numbers, dashes, and underscores.
        </Text>
      </div>

      <div className="mb-6 max-w-md">
        <Text className="mb-1.5" size="small">
          Email
        </Text>
        <Input disabled type="email" value={user.email} />
        <Text className="mt-2 text-ui-fg-muted" size="xsmall">
          Email changes aren't supported here yet. Contact support to update
          your email.
        </Text>
      </div>

      <LoadingButton
        disabled={!dirty || username.trim().length === 0}
        loading={savingProfile}
        type="submit"
        variant="omi"
      >
        Save changes
      </LoadingButton>
    </form>
  );
}
