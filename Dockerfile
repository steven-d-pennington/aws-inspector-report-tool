# Multi-stage Dockerfile for AWS Inspector Report Tool

# Stage 1: Production dependencies
FROM node:18-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Development dependencies
FROM node:18-alpine AS dev-dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 3: Development runtime (optional, build with --target development)
FROM node:18-alpine AS development
WORKDIR /app

RUN apk add --no-cache \
    bash \
    curl \
    git

COPY --from=dev-dependencies /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3010 9229
CMD ["npx", "nodemon", "server.js"]

# Stage 4: Production image (default)
FROM node:18-alpine AS production
WORKDIR /app

RUN apk add --no-cache dumb-init

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs server.js ./
COPY --chown=nodejs:nodejs src ./src
COPY --chown=nodejs:nodejs views ./views
COPY --chown=nodejs:nodejs public ./public
COPY --chown=nodejs:nodejs scripts ./scripts
COPY --chown=nodejs:nodejs migrations ./migrations

RUN mkdir -p uploads logs && \
    chown -R nodejs:nodejs uploads logs

USER nodejs

EXPOSE 3010

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3010/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]