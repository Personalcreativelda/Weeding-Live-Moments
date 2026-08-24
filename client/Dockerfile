# syntax=docker/dockerfile:1
#
# Frontend only. Build context is this client/ directory —
# the API (server/) is a fully separate container/deployment.
#
# IMPORTANT: Vite bakes VITE_* variables into the compiled JS at BUILD time,
# not at container runtime. VITE_API_URL must be passed as a build ARG
# (docker-compose.yml already does this from client/.env), not as a normal
# runtime environment variable on the running container.

# ---- Build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- Runtime ----
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
