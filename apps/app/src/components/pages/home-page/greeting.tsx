import { cn } from "@omi/ui";
import { Heading } from "@omi/ui/heading";

function getGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 5) {
    return "Good night";
  }
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 18) {
    return "Good afternoon";
  }
  return "Good evening";
}

export function Greeting({
  username,
  aiAccess = false,
}: {
  username: string;
  workspaceName: string;
  workspaceIcon?: string;
  workspaceIconColor?: string;
  workspaceEmoji?: string;
  aiAccess: boolean;
}) {
  const greeting = getGreeting(new Date());

  return (
    <div className="mb-14 flex flex-col items-start">
      <Heading
        className={cn(
          aiAccess ? "text-ui-fg-muted" : "text-ui-fg-base",
          "font-medium text-2xl"
        )}
        level="h2"
      >
        {greeting}, {username}
      </Heading>
      {aiAccess && (
        <Heading className="font-medium text-2xl text-ui-fg-base" level="h3">
          How can I help you today?
        </Heading>
      )}
    </div>
  );
}
