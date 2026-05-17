import { Button } from "@omi/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@omi/ui/tabs";
import { Text } from "@omi/ui/text";
import {
  RiArrowLeftLine,
  RiBankCardLine,
  RiBarChart2Line,
  RiBuilding2Line,
  RiComputerLine,
  RiLinksFill,
  RiPlugLine,
  RiShieldUserLine,
  RiUserLine,
} from "@remixicon/react";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, Suspense } from "react";
import { AccountTab } from "./account-tab";
import { BillingTab } from "./billing-tab";
import { ConnectionsTab } from "./connections-tab";
import { DevicesTab } from "./devices-tab";
import { GeneralTab } from "./general-tab";
import { McpTab } from "./mcp-tab";
import { TabSkeleton } from "./tab-skeleton";
import { UsageTab } from "./usage-tab";
import { WorkspacesTab } from "./workspaces-tab";

function TabPanel({
  value,
  children,
}: {
  value: UserSettingsTab;
  children: ReactNode;
}) {
  return (
    <TabsContent keepMounted value={value}>
      <Suspense fallback={<TabSkeleton />}>{children}</Suspense>
    </TabsContent>
  );
}

export type UserSettingsTab =
  | "general"
  | "workspaces"
  | "connections"
  | "devices"
  | "mcp"
  | "usage"
  | "billing"
  | "account";

export function UserSettingsPageComponent({
  tab,
  onTabChange,
}: {
  tab: UserSettingsTab;
  onTabChange: (next: UserSettingsTab) => void;
}) {
  const navigate = useNavigate();

  return (
    <Tabs
      className="h-full"
      onValueChange={(next) => onTabChange(next as UserSettingsTab)}
      orientation="vertical"
      value={tab}
    >
      <div className="sticky top-0 flex h-screen w-52 shrink-0 flex-col gap-3 self-start border-r-[0.5px] py-8 pr-4 pl-6">
        <Button
          className="self-start"
          onClick={() => navigate({ to: "/" })}
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
              Integrations
            </Text>
          </TabsTrigger>
          <TabsTrigger className="grow-0 pl-3" value="devices">
            <RiComputerLine className="size-4" />
            <Text className="ml-1 font-medium" size="small">
              Devices
            </Text>
          </TabsTrigger>
          <TabsTrigger className="grow-0 pl-3" value="mcp">
            <RiPlugLine className="size-4" />
            <Text className="ml-1 font-medium" size="small">
              MCP
            </Text>
          </TabsTrigger>
          <TabsTrigger className="grow-0 pl-3" value="usage">
            <RiBarChart2Line className="size-4" />
            <Text className="ml-1 font-medium" size="small">
              Usage
            </Text>
          </TabsTrigger>
          <TabsTrigger className="grow-0 pl-3" value="billing">
            <RiBankCardLine className="size-4" />
            <Text className="ml-1 font-medium" size="small">
              Billing
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
      <div className="flex min-w-0 flex-1 justify-center">
        <div className="mt-8 min-h-[calc(95vh-80px)] w-full max-w-[640px] px-4 py-8 md:px-0">
          <TabPanel value="general">
            <GeneralTab />
          </TabPanel>
          <TabPanel value="workspaces">
            <WorkspacesTab />
          </TabPanel>
          <TabPanel value="connections">
            <ConnectionsTab />
          </TabPanel>
          <TabPanel value="devices">
            <DevicesTab />
          </TabPanel>
          <TabPanel value="mcp">
            <McpTab />
          </TabPanel>
          <TabPanel value="usage">
            <UsageTab />
          </TabPanel>
          <TabPanel value="billing">
            <BillingTab />
          </TabPanel>
          <TabPanel value="account">
            <AccountTab />
          </TabPanel>
        </div>
      </div>
      <div aria-hidden className="w-52 shrink-0" />
    </Tabs>
  );
}
