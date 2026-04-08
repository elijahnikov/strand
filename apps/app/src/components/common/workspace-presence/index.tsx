import type { PresenceState } from "@convex-dev/presence/react";
import usePresence from "@convex-dev/presence/react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/_generated/api.js";
import type { Id } from "@strand/backend/_generated/dataModel.js";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useConvex, useQuery } from "convex/react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

export { WorkspacePresenceAvatars } from "./workspace-presence-avatars";

const HEARTBEAT_INTERVAL = 10_000;
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
  const convex = useConvex();
  const userId = data.user?._id ?? "";

  const workspaceIdRef = useRef(workspaceId);
  const userIdRef = useRef(userId);
  useEffect(() => {
    workspaceIdRef.current = workspaceId;
    userIdRef.current = userId;
  }, [workspaceId, userId]);

  useEffect(() => {
    const handlePageHide = () => {
      if (!(workspaceIdRef.current && userIdRef.current)) {
        return;
      }
      const siteUrl = convex.url.replace(".cloud", ".site");
      navigator.sendBeacon(
        `${siteUrl}/presence/disconnect`,
        new Blob(
          [
            JSON.stringify({
              roomId: workspaceIdRef.current,
              userId: userIdRef.current,
            }),
          ],
          { type: "application/json" }
        )
      );
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [convex.url]);

  const presenceStates = usePresence(
    api.presence,
    workspaceId,
    userId,
    HEARTBEAT_INTERVAL
  );

  const visibleStates = useMemo(
    () => presenceStates?.slice(0, MAX_VISIBLE_USERS) ?? [],
    [presenceStates]
  );

  const userIds = useMemo(
    () =>
      visibleStates
        .filter((s): s is PresenceState & { userId: string } =>
          Boolean(s.userId)
        )
        .map((s) => s.userId as Id<"user">),
    [visibleStates]
  );

  const userData = useQuery(
    api.presence.getUsersInRoom,
    userIds.length > 0 ? { userIds } : "skip"
  );

  const users = useMemo(() => {
    if (!userData) {
      return [] as PresenceUser[];
    }
    const result: PresenceUser[] = [];
    for (const state of visibleStates) {
      const user = userData.find(
        (u: { _id: string } | null) => u?._id === state.userId
      );
      if (user) {
        result.push({
          _id: user._id as Id<"user">,
          username: user.username,
          image: user.image,
          online: state.online,
        });
      }
    }
    return result;
  }, [visibleStates, userData]);

  const value = useMemo(
    () => ({ users, isLoading: !presenceStates }),
    [users, presenceStates]
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
