# syntax=docker/dockerfile:1
#
# Builds only the API server. The client is a separate deployment on Vercel
# (see README.md) — it is not part of this image.

# ---- Build ----
FROM node:20-alpine AS build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ---- Runtime ----
FROM node:20-alpine AS runtime
RUN apk add --no-cache dumb-init
WORKDIR /app/server

ENV NODE_ENV=production

COPY server/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/server/dist ./dist

EXPOSE 4100
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4100)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
