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
}: {
  username: string;
  workspaceName: string;
  workspaceIcon?: string;
  workspaceIconColor?: string;
  workspaceEmoji?: string;
}) {
  const greeting = getGreeting(new Date());

  return (
    <div className="mb-14 flex flex-col items-start gap-2">
      <Heading className="font-medium text-2xl text-ui-fg-base" level="h2">
        {greeting}, {username}
      </Heading>
    </div>
  );
}
