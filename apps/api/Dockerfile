FROM node:24.22.2-bookworm AS build
WORKDIR /workspace
RUN if [ "$(npm --version)" != '11.19.1' ]; then npm install --global npm@11.19.1; fi
COPY package*.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN if [ -f package-lock.json ]; then \
      npm ci --workspace @easygenerator/api --include-workspace-root; \
    else \
      npm install --workspace @easygenerator/api --include-workspace-root; \
    fi
COPY apps/api apps/api
RUN npm run build --workspace @easygenerator/api && npm prune --omit=dev --workspace @easygenerator/api

FROM node:24.22.2-bookworm-slim
WORKDIR /workspace
RUN install -d -m 0700 -o node -g node /var/lib/easygenerator/jwt
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/api/scripts/start-local.mjs ./apps/api/scripts/start-local.mjs
USER node
CMD ["node", "apps/api/scripts/start-local.mjs"]
