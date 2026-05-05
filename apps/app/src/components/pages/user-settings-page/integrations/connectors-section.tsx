import { Badge } from "@omi/ui/badge";
import { Heading } from "@omi/ui/heading";
import { Text } from "@omi/ui/text";

export function ConnectorsSection() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Heading level="h3">Connectors</Heading>
        <Badge size="sm" variant="warning">
          Coming soon
        </Badge>
      </div>
      <Text className="text-ui-fg-subtle" size="small">
        Bring your own MCP server to expose tools to the AI chat. Connectors run
        alongside your integrations.
      </Text>
    </div>
  );
}
