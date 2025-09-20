# Multi-stage Dockerfile for AWS Inspector Report Tool

# Stage 1: Build dependencies
FROM node:18-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Build dev dependencies
FROM node:18-alpine AS dev-dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 3: Production image
FROM node:18-alpine AS production
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Create necessary directories
RUN mkdir -p uploads logs && \
    chown -R nodejs:nodejs uploads logs

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]

# Stage 4: Development image
FROM node:18-alpine AS development
WORKDIR /app

# Install development tools
RUN apk add --no-cache \
    bash \
    curl \
    git

# Copy all dependencies
COPY --from=dev-dependencies /app/node_modules ./node_modules

# Copy package files for potential npm install
COPY package*.json ./

# Expose application port
EXPOSE 3000

# Expose debugger port
EXPOSE 9229

# Use nodemon for hot reload in development
CMD ["npx", "nodemon", "server.js"]