import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);

export const {
  getSnapshot,
  submitSnapshot,
  latestVersion,
  getSteps,
  submitSteps,
} = prosemirrorSync.syncApi<DataModel>({
  onSnapshot: async (ctx, id, snapshot) => {
    const resourceId = id as DataModel["resource"]["document"]["_id"];
    const resource = await ctx.db.get(resourceId);
    if (!resource) {
      return;
    }

    const existing = await ctx.db
      .query("resourceContent")
      .withIndex("by_resource", (q) => q.eq("resourceId", resourceId))
      .unique();

    const patch = {
      jsonContent: snapshot,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("resourceContent", {
        resourceId,
        ...patch,
      });
    }

    await ctx.db.patch(resourceId, { updatedAt: Date.now() });
  },
});
