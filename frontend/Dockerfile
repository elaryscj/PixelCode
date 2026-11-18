FROM node:24-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:24-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
ARG VITE_API_URL=""
ARG VITE_WS_URL=""
ENV VITE_API_URL=$VITE_API_URL VITE_WS_URL=$VITE_WS_URL
RUN npm run build

# SPA mode: only static files plus a tiny dependency-free server (scripts/serve-static.mjs)
FROM node:24-alpine
COPY --from=build-env /app/build/client /app/build/client
COPY scripts/serve-static.mjs /app/serve-static.mjs
WORKDIR /app
EXPOSE 3000
CMD ["node", "serve-static.mjs", "build/client"]
