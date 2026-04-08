#!/bin/bash
CMD="cd ../../apps/app && turbo run build"

if [ "$VERCEL_ENV" = "production" ]; then
  bunx convex deploy --cmd "$CMD" --cmd-url-env-var-name VITE_CONVEX_URL
else
  bunx convex deploy --preview-create "$VERCEL_GIT_COMMIT_REF" --cmd "$CMD" --cmd-url-env-var-name VITE_CONVEX_URL
fi
