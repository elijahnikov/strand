import { Button } from "@omi/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@omi/ui/tabs";
import { Text } from "@omi/ui/text";
import { RiArrowLeftLine, RiBankCardLine, RiLinksFill } from "@remixicon/react";
import { useRouter } from "@tanstack/react-router";
import { PageContent } from "~/components/common/page-content";
import { BillingTab } from "./billing-tab";
import { ConnectionsTab } from "./connections-tab";

export type UserSettingsTab = "connections" | "billing";

export function UserSettingsPageComponent({
  tab,
  onTabChange,
}: {
  tab: UserSettingsTab;
  onTabChange: (next: UserSettingsTab) => void;
}) {
  const router = useRouter();
  return (
    <PageContent className="mt-8 h-[calc(95vh-80px)] py-8" width="xl:w-2/3">
      <Tabs
        className="h-full"
        onValueChange={(next) => onTabChange(next as UserSettingsTab)}
        orientation="vertical"
        value={tab}
      >
        <div className="fixed flex h-screen w-44 shrink-0 flex-col gap-3 self-start border-r-[0.5px] pr-4">
          <Button
            className="self-start"
            onClick={() => router.history.back()}
            size="small"
            variant="ghost"
          >
            <RiArrowLeftLine className="size-4" />
            <Text className="font-medium" size="small">
              Back
            </Text>
          </Button>
          <TabsList className="w-full items-start justify-start">
            <TabsTrigger className="grow-0 pl-3" value="connections">
              <RiLinksFill className="size-4" />
              <Text className="ml-1 font-medium" size="small">
                Connections
              </Text>
            </TabsTrigger>
            <TabsTrigger className="grow-0 pl-3" value="billing">
              <RiBankCardLine className="size-4" />
              <Text className="ml-1 font-medium" size="small">
                Billing
              </Text>
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="ml-44 h-fit w-full pb-8">
          <TabsContent className="pl-8" value="connections">
            <ConnectionsTab />
          </TabsContent>
          <TabsContent className="pl-8" value="billing">
            <BillingTab />
          </TabsContent>
        </div>
      </Tabs>
    </PageContent>
  );
}
