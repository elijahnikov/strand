import { Card } from "@omi/ui/card";
import { FlickeringGrid } from "@omi/ui/flickering-grid";
import { motion } from "motion/react";
import { useState } from "react";

export function VideoPreview({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative mt-4">
      {!loaded && (
        <Card className="absolute inset-0 z-0 overflow-hidden p-0">
          <FlickeringGrid
            className="size-full"
            color="#6B7280"
            flickerChance={0.1}
            gridGap={6}
            maxOpacity={0.5}
            squareSize={4}
          />
        </Card>
      )}
      <motion.div
        animate={{ opacity: loaded ? 1 : 0 }}
        className="aspect-video w-full overflow-hidden rounded-xl border border-ui-border-base bg-black"
        initial={false}
        transition={{ duration: 0.2 }}
      >
        {/** biome-ignore lint/a11y/useMediaCaption: user uploaded videos have no captions available */}
        <video
          className="h-full w-full"
          controls
          onLoadedMetadata={() => setLoaded(true)}
          preload="metadata"
          src={url}
        />
      </motion.div>
    </div>
  );
}
