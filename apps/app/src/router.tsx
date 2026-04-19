import { ConvexQueryClient } from "@convex-dev/react-query";
import { toastManager } from "@strand/ui/toast";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexError } from "convex/values";
import { ErrorState } from "./components/common/error-state";
import { NotFoundState } from "./components/common/not-found-state";
import { routeTree } from "./routeTree.gen";

const SILENCED_QUERY_ERROR_PATTERN =
  /not authenticated|not authorized|unauthenticated|unauthorized|user not found|not a member|not found|ArgumentValidationError|does not match validator/i;

function getShortErrorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** Set to true when a mutation's call site handles its own error toast. */
      customErrorToast?: boolean;
    };
  }
}

export function getRouter() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("missing envar VITE_CONVEX_URL");
  }

  const convexQueryClient = new ConvexQueryClient(convexUrl, {
    expectAuth: true,
  });

  const queryCache = new QueryCache({
    onError: (error) => {
      const fullMessage =
        error instanceof Error ? error.message : "Unknown error";
      if (SILENCED_QUERY_ERROR_PATTERN.test(fullMessage)) {
        return;
      }
      toastManager.add({
        type: "error",
        title: "Failed to load",
        description: getShortErrorMessage(error),
      });
    },
  });

  const mutationCache = new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.customErrorToast) {
        return;
      }
      const fullMessage =
        error instanceof Error ? error.message : "Unknown error";
      if (SILENCED_QUERY_ERROR_PATTERN.test(fullMessage)) {
        return;
      }
      toastManager.add({
        type: "error",
        title: "Something went wrong",
        description: getShortErrorMessage(error),
      });
    },
  });

  const queryClient: QueryClient = new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultErrorComponent: ({ error, reset }) => (
      <ErrorState error={error} reset={reset} />
    ),
    defaultNotFoundComponent: () => <NotFoundState />,
    context: { queryClient, convexQueryClient },
    scrollRestoration: true,
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
}
