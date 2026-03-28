import { convexQuery } from "@convex-dev/react-query";
import { api } from "@strand/backend/api";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data } = useSuspenseQuery(convexQuery(api.tasks.get, {}));

  return (
    <main className="container h-screen py-16">
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="font-extrabold text-5xl tracking-tight sm:text-[5rem]">
          Create <span className="text-primary">T3</span> Turbo
        </h1>
        {data.map(({ _id, text }) => (
          <div key={_id}>{text}</div>
        ))}
      </div>
    </main>
  );
}
