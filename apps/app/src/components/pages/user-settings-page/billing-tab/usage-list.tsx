import { convexQuery } from "@convex-dev/react-query";
import { api } from "@omi/backend/_generated/api.js";
import { Text } from "@omi/ui/text";
import { useQuery } from "@tanstack/react-query";

export function UsageList() {
  const { data, isLoading } = useQuery(
    convexQuery(api.billing.queries.getMyUsageByWorkspace, {})
  );

  if (isLoading) {
    return null;
  }

  const rows = data ?? [];

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <Text className="font-medium" size="small">
        Usage this period
      </Text>
      {rows.length === 0 ? (
        <Text className="text-ui-fg-subtle" size="small">
          No credits spent yet this period.
        </Text>
      ) : (
        <ul className="flex flex-col divide-y">
          {rows.map((row) => (
            <li
              className="flex items-center justify-between py-2"
              key={row.workspaceId}
            >
              <Text size="small">{row.name}</Text>
              <Text className="text-ui-fg-subtle" size="small">
                {row.credits.toLocaleString()} credits
              </Text>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
