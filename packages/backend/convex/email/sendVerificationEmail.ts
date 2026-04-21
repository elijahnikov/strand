import { renderVerificationEmail } from "@omi/email";
import { senders } from "@omi/email/senders";
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { resend } from "./resend";

export const send = internalMutation({
  args: {
    to: v.string(),
    url: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { subject, html, text } = await renderVerificationEmail({
      url: args.url,
      name: args.name,
    });

    await resend.sendEmail(ctx, {
      from: senders.verification,
      to: args.to,
      subject,
      html,
      text,
      replyTo: [senders.supportReplyTo],
    });
  },
});
