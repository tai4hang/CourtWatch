# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies (including OCI CLI)
RUN apk add --no-cache openssl ca-certificates curl unzip python3 py3-pip && \
    pip3 install --no-cache-dir oci-cli --break-system-packages

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built artifacts
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Copy entrypoint script
COPY --chown=nodejs:nodejs entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_TYPE=oracle
# Use Thin mode - no Instant Client needed

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application with entrypoint
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/main.js"]
