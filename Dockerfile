FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci
# Installer explicitement la dépendance manquante pour Alpine Linux
RUN npm install @rollup/rollup-linux-x64-musl

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Install Node.js and required packages
RUN apk add --no-cache nodejs npm sqlite curl

# Create app directory
WORKDIR /app

# Create data directory for SQLite database with restrictive permissions
RUN mkdir -p /app/data && \
    addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app/data

# Create required nginx directories with correct permissions for non-root
RUN mkdir -p /var/cache/nginx \
    /var/run \
    /var/log/nginx && \
    chown -R appuser:appgroup /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove default nginx pid path config to allow non-root pid file
RUN sed -i 's|/var/run/nginx.pid|/tmp/nginx.pid|g' /etc/nginx/nginx.conf

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/server /app/server
COPY --from=build /app/shared /app/shared
COPY --from=build /app/package*.json /app/

# Install production dependencies
RUN npm ci --production

# Switch to non-root user for security
# USER appuser (Disabled for now as nginx might still need root for startup, but directories are ready)

# Start command
CMD ["sh", "-c", "nginx -g 'daemon off;' & NODE_ENV=production node server/index.js"]