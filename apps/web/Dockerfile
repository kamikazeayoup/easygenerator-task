FROM node:24.22.2-bookworm AS build
WORKDIR /workspace
RUN if [ "$(npm --version)" != '11.19.1' ]; then npm install --global npm@11.19.1; fi
COPY package*.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN if [ -f package-lock.json ]; then \
      npm ci --workspace @easygenerator/web --include-workspace-root; \
    else \
      npm install --workspace @easygenerator/web --include-workspace-root; \
    fi
COPY apps/web apps/web
RUN npm run build --workspace @easygenerator/web

FROM nginx:stable-alpine
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist/ /usr/share/nginx/html/
