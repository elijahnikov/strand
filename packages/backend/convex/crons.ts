import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "reset due billing credits",
  { hourUTC: 2, minuteUTC: 0 },
  internal.billing.sync.resetDueCredits,
  {}
);

export default crons;
