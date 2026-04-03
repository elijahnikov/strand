const DOT_ORBIT_ORDER = [0, 1, 3, 5, 4, 2] as const;

export function DotGridLoader() {
  return (
    <>
      <style>{`
        @keyframes dot-orbit {
          0%, 100% { opacity: 1; }
          16.67%, 83.33% { opacity: 0.2; }
        }
      `}</style>
      <div className="grid h-3.5 w-2.5 grid-cols-2 grid-rows-3 gap-[0.5px]">
        {Array.from({ length: 6 }).map((_, i) => {
          const orbitIndex = DOT_ORBIT_ORDER.indexOf(
            i as 0 | 1 | 2 | 3 | 4 | 5
          );
          return (
            <span
              className="h-0.75 w-0.75 rounded-full bg-ui-fg-subtle"
              key={`dot-${i.toString()}`}
              style={{
                opacity: 0.2,
                animation: "dot-orbit 1.2s ease-in-out infinite",
                animationDelay: `${orbitIndex * 0.2}s`,
              }}
            />
          );
        })}
      </div>
    </>
  );
}
