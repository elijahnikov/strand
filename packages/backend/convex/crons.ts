import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "reset due billing credits",
  { hourUTC: 2, minuteUTC: 0 },
  internal.billing.sync.resetDueCredits,
  {}
);

crons.interval(
  "integrations: poll-fallback delta sync",
  { minutes: 30 },
  internal.connections.sync.scheduler.enqueueDeltaPolls,
  {}
);

crons.daily(
  "integrations: pause downgraded connections",
  { hourUTC: 3, minuteUTC: 0 },
  internal.connections.sync.scheduler.pauseDowngradedConnections,
  {}
);

export default crons;
