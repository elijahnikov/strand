import { Badge } from "@strand/ui/badge";

interface ConceptData {
  importance: number;
  name: string;
}

export function ResourceConcepts({ concepts }: { concepts: ConceptData[] }) {
  if (concepts.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {concepts
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 5)
        .map((concept) => (
          <Badge
            className="border border-blue-600/20 px-1.5 font-mono text-xs"
            key={concept.name}
            style={{ opacity: 0.5 + concept.importance * 0.5 }}
            variant="info"
          >
            #{concept.name}
          </Badge>
        ))}
    </div>
  );
}
