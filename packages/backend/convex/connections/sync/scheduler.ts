import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { internalAction, internalMutation } from "../../_generated/server";

const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h since last webhook → eligible for poll
const IDLE_PAUSE_MS = 14 * 24 * 60 * 60 * 1000; // 14d workspace inactivity → pause

export const enqueueDeltaPolls = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const connections = await ctx.db
      .query("connection")
      .withIndex("by_status_syncEnabled", (q) =>
        q.eq("status", "active").eq("syncEnabled", true)
      )
      .collect();

    let scheduled = 0;
    for (const conn of connections) {
      if (!conn.workspaceId) {
        continue;
      }

      const lastAccess = await ctx.db
        .query("workspaceMember")
        .withIndex("by_workspace", (q) =>
          q.eq("workspaceId", conn.workspaceId as Id<"workspace">)
        )
        .collect();
      const mostRecentAccess = lastAccess.reduce(
        (max, m) => Math.max(max, m.lastAccessedAt),
        0
      );
      if (mostRecentAccess && now - mostRecentAccess > IDLE_PAUSE_MS) {
        continue;
      }

      const webhookFresh =
        conn.lastWebhookAt && now - conn.lastWebhookAt < POLL_INTERVAL_MS;
      if (webhookFresh) {
        continue;
      }

      await ctx.scheduler.runAfter(
        0,
        internal.connections.sync.worker.runDelta,
        { connectionId: conn._id }
      );
      scheduled += 1;
    }
    return { scheduled };
  },
});

export const pauseDowngradedConnections = internalAction({
  args: {},
  handler: async (ctx): Promise<{ paused: number }> => {
    const result = await ctx.runMutation(
      internal.connections.sync.scheduler.runPauseDowngraded,
      {}
    );
    return result;
  },
});

export const runPauseDowngraded = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ paused: number }> => {
    const connections = await ctx.db
      .query("connection")
      .withIndex("by_status_syncEnabled", (q) =>
        q.eq("status", "active").eq("syncEnabled", true)
      )
      .collect();

    let paused = 0;
    for (const conn of connections) {
      const user = await ctx.db.get(conn.userId);
      if (!user?.personalBillingAccountId) {
        continue;
      }
      const account = await ctx.db.get(user.personalBillingAccountId);
      if (!account || account.plan === "pro") {
        continue;
      }
      await ctx.db.patch(conn._id, {
        status: "paused",
        syncEnabled: false,
      });
      paused += 1;
    }
    return { paused };
  },
});
