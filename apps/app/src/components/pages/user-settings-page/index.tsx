import { Button } from "@omi/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@omi/ui/tabs";
import { Text } from "@omi/ui/text";
import {
  RiArrowLeftLine,
  RiBankCardLine,
  RiBuilding2Line,
  RiComputerLine,
  RiLinksFill,
  RiShieldUserLine,
  RiUserLine,
} from "@remixicon/react";
import { useRouter } from "@tanstack/react-router";
import { PageContent } from "~/components/common/page-content";
import { AccountTab } from "./account-tab";
import { ConnectionsTab } from "./connections-tab";
import { DevicesTab } from "./devices-tab";
import { GeneralTab } from "./general-tab";
import { UsageAndBillingTab } from "./usage-and-billing-tab";
import { WorkspacesTab } from "./workspaces-tab";

export type UserSettingsTab =
  | "general"
  | "workspaces"
  | "connections"
  | "devices"
  | "billing"
  | "account";

export function UserSettingsPageComponent({
  tab,
  onTabChange,
}: {
  tab: UserSettingsTab;
  onTabChange: (next: UserSettingsTab) => void;
}) {
  const router = useRouter();
  return (
    <PageContent className="mt-8 min-h-[calc(95vh-80px)] py-8" width="xl:w-2/3">
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
            <TabsTrigger className="grow-0 pl-3" value="general">
              <RiUserLine className="size-4" />
              <Text className="ml-1 font-medium" size="small">
                General
              </Text>
            </TabsTrigger>
            <TabsTrigger className="grow-0 pl-3" value="workspaces">
              <RiBuilding2Line className="size-4" />
              <Text className="ml-1 font-medium" size="small">
                Workspaces
              </Text>
            </TabsTrigger>
            <TabsTrigger className="grow-0 pl-3" value="connections">
              <RiLinksFill className="size-4" />
              <Text className="ml-1 font-medium" size="small">
                Connections
              </Text>
            </TabsTrigger>
            <TabsTrigger className="grow-0 pl-3" value="devices">
              <RiComputerLine className="size-4" />
              <Text className="ml-1 font-medium" size="small">
                Devices
              </Text>
            </TabsTrigger>
            <TabsTrigger className="grow-0 pl-3" value="billing">
              <RiBankCardLine className="size-4" />
              <Text className="ml-1 font-medium" size="small">
                Usage & Billing
              </Text>
            </TabsTrigger>
            <TabsTrigger className="grow-0 pl-3" value="account">
              <RiShieldUserLine className="size-4" />
              <Text className="ml-1 font-medium" size="small">
                Account
              </Text>
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="ml-44 h-fit w-full pb-8">
          <TabsContent className="pl-8" value="general">
            <GeneralTab />
          </TabsContent>
          <TabsContent className="pl-8" value="workspaces">
            <WorkspacesTab />
          </TabsContent>
          <TabsContent className="pl-8" value="connections">
            <ConnectionsTab />
          </TabsContent>
          <TabsContent className="pl-8" value="devices">
            <DevicesTab />
          </TabsContent>
          <TabsContent className="pl-8" value="billing">
            <UsageAndBillingTab />
          </TabsContent>
          <TabsContent className="pl-8" value="account">
            <AccountTab />
          </TabsContent>
        </div>
      </Tabs>
    </PageContent>
  );
}
