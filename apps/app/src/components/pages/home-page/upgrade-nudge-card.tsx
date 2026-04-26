import { Button } from "@omi/ui/button";
import { Text } from "@omi/ui/text";
import { RiSparklingLine } from "@remixicon/react";
import { useNavigate } from "@tanstack/react-router";
import { HomeCard } from "./card";

export function UpgradeNudgeCard() {
  const navigate = useNavigate();

  return (
    <HomeCard className="bg-linear-to-br from-ui-tag-purple-bg/40 to-ui-bg-component p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ui-tag-purple-bg text-ui-tag-purple-text">
          <RiSparklingLine className="size-4" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <p className="font-medium text-sm text-ui-fg-base">
            Let your library work for you
          </p>
          <Text className="text-ui-fg-subtle" size="small">
            Upgrade to surface concept clusters, recent connections, and
            forgotten resources right on your home page.
          </Text>
          <div className="mt-3 flex items-center gap-2">
            <Button
              onClick={() => navigate({ to: "/account" })}
              size="small"
              variant="omi"
            >
              View plans
            </Button>
            <Text className="text-ui-fg-muted" size="xsmall">
              Available on Basic and Pro
            </Text>
          </div>
        </div>
      </div>
    </HomeCard>
  );
}
