#!/bin/bash
CMD="cd ../../apps/app && turbo run build"
ENV_VAR="VITE_CONVEX_URL"

if [ "$VERCEL_ENV" = "production" ]; then
  bunx convex deploy --cmd "$CMD" --cmd-url-env-var-name "$ENV_VAR"
else
  bunx convex deploy --preview-create "preview" --cmd "$CMD" --cmd-url-env-var-name "$ENV_VAR"
fi
