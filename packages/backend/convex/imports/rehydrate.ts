import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

const REHYDRATE_CONCURRENCY = 20;
const DOMAIN_DELAY_MS = 1000;

export const scheduleRehydration = internalAction({
  args: {
    resourceIds: v.array(v.id("resource")),
  },
  handler: async (ctx, args) => {
    const domainLastScheduled = new Map<string, number>();
    let globalOffset = 0;

    for (let i = 0; i < args.resourceIds.length; i++) {
      const resourceId = args.resourceIds[i];
      if (!resourceId) {
        continue;
      }
      const website = await ctx.runQuery(
        internal.resource.internals.getWebsiteResource,
        { resourceId }
      );
      if (!website) {
        continue;
      }

      const domain = website.domain ?? "";
      const now = Date.now();
      const domainNext =
        (domainLastScheduled.get(domain) ?? now) + DOMAIN_DELAY_MS;
      const batchDelay =
        Math.floor(i / REHYDRATE_CONCURRENCY) * (DOMAIN_DELAY_MS / 2);
      const scheduledAt = Math.max(now + batchDelay + globalOffset, domainNext);

      domainLastScheduled.set(domain, scheduledAt);
      globalOffset = Math.max(globalOffset, scheduledAt - now);

      await ctx.scheduler.runAt(
        scheduledAt,
        internal.resource.actions.extractWebsiteMetadata,
        { resourceId, skipAI: true }
      );
    }
  },
});
