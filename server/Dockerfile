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

# Install Oracle Instant Client
RUN apk add --no-cache \
    libaio \
    unzip \
    curl \
    && curl -Lo /tmp/instantclient.zip https://download.oracle.com/oracle-instantclient/instantclient-basic-linuxx64.zip \
    && unzip -o /tmp/instantclient.zip -d /opt \
    && ln -s /opt/instantclient_21_3/libclntsh.so.21.1 /opt/instantclient_21_3/libclntsh.so \
    && echo "/opt/instantclient_21_3" > /etc/ld.so.conf.d/oracle.conf \
    && ldconfig \
    && rm /tmp/instantclient.zip

WORKDIR /app

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built artifacts
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV LD_LIBRARY_PATH=/opt/instantclient_21_3:$LD_LIBRARY_PATH

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["node", "dist/main.js"]
