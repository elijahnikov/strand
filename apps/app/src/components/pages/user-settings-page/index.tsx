import { RiLinksFill } from "@remixicon/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@omi/ui/tabs";
import { Text } from "@omi/ui/text";
import { PageContent } from "~/components/common/page-content";
import { ConnectionsTab } from "./connections-tab";

export function UserSettingsPageComponent() {
  return (
    <PageContent className="mt-8 h-[calc(95vh-80px)] py-8" width="xl:w-2/3">
      <Tabs
        className="h-full"
        defaultValue="connections"
        orientation="vertical"
      >
        <TabsList className="fixed h-full w-44 shrink-0 items-start justify-start self-start pr-4">
          <TabsTrigger className="grow-0 pl-3" value="connections">
            <RiLinksFill className="size-4" />
            <Text className="ml-1 font-medium" size="small">
              Connections
            </Text>
          </TabsTrigger>
        </TabsList>
        <div className="ml-44 h-fit min-h-[calc(100vh-140px)] w-full border-l-[0.5px] pb-8">
          <TabsContent className="pl-8" value="connections">
            <ConnectionsTab />
          </TabsContent>
        </div>
      </Tabs>
    </PageContent>
  );
}
