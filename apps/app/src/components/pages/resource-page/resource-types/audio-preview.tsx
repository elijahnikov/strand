export function AudioPreview({ url }: { url: string }) {
  return (
    <div className="mt-4 w-full rounded-xl border border-ui-border-base bg-ui-bg-subtle p-4">
      {/** biome-ignore lint/a11y/useMediaCaption: user uploaded audio files have no captions available */}
      <audio className="w-full" controls preload="metadata" src={url} />
    </div>
  );
}
