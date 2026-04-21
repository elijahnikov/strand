import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import type { Id } from "@omi/backend/_generated/dataModel.js";
import { instantDb } from "@omi/backend/instant";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from "react";

export { WorkspacePresenceAvatars } from "./workspace-presence-avatars";

const MAX_VISIBLE_USERS = 5;

interface PresenceUser {
  _id: Id<"user">;
  image?: string | null;
  online: boolean;
  username: string;
}

interface WorkspacePresenceContextValue {
  isLoading: boolean;
  users: PresenceUser[];
}

const WorkspacePresenceContext =
  createContext<WorkspacePresenceContextValue | null>(null);

export function WorkspacePresenceProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const { data } = useSuspenseQuery(
    convexQuery(api.user.queries.currentUser, {})
  );
  const currentUser = data.user;
  const userId = currentUser?._id ?? "";
  const username = currentUser?.username ?? "";
  const avatar = currentUser?.image ?? "";

  const room = instantDb.room("workspace", workspaceId);

  const {
    user: myPresence,
    peers,
    publishPresence,
  } = instantDb.rooms.usePresence(room, {
    initialPresence: { userId, name: username, avatar },
  });

  useEffect(() => {
    if (userId) {
      publishPresence({ userId, name: username, avatar });
    }
  }, [userId, username, avatar, publishPresence]);

  const users = useMemo(() => {
    const all: Array<{ userId: string; name: string; avatar: string }> = [];
    // if (myPresence?.userId) {
    //   all.push({
    //     userId: myPresence.userId,
    //     name: myPresence.name,
    //     avatar: myPresence.avatar,
    //   });
    // }
    for (const peer of Object.values(peers)) {
      if (peer?.userId) {
        all.push({
          userId: peer.userId,
          name: peer.name,
          avatar: peer.avatar,
        });
      }
    }

    const seen = new Set<string>();
    const deduped: PresenceUser[] = [];
    for (const p of all) {
      if (seen.has(p.userId)) {
        continue;
      }
      seen.add(p.userId);
      deduped.push({
        _id: p.userId as Id<"user">,
        username: p.name,
        image: p.avatar || null,
        online: true,
      });
      if (deduped.length >= MAX_VISIBLE_USERS) {
        break;
      }
    }
    return deduped;
  }, [peers]);

  const value = useMemo(
    () => ({ users, isLoading: !myPresence }),
    [users, myPresence]
  );

  return (
    <WorkspacePresenceContext.Provider value={value}>
      {children}
    </WorkspacePresenceContext.Provider>
  );
}

export function useWorkspacePresence() {
  const context = useContext(WorkspacePresenceContext);
  if (!context) {
    throw new Error(
      "useWorkspacePresence must be used within WorkspacePresenceProvider"
    );
  }
  return context;
}

export function useWorkspacePresenceSafe() {
  return useContext(WorkspacePresenceContext);
}
