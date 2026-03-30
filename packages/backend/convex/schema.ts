import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  user: defineTable({
    username: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    onboardedAt: v.optional(v.string()),
    onboardingStep: v.number(),
  }).index("by_email", ["email"]),
});
