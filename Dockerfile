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

# Create data directory for SQLite database
RUN mkdir -p /app/data && chmod -R 777 /app/data

# Create required directories with correct permissions
RUN mkdir -p /var/cache/nginx \
    /var/run \
    /var/log/nginx \
    /var/cache/nginx/client_temp \
    /var/cache/nginx/proxy_temp \
    /var/cache/nginx/fastcgi_temp \
    /var/cache/nginx/uwsgi_temp \
    /var/cache/nginx/scgi_temp && \
    chmod -R 777 /var/cache/nginx \
    /var/run \
    /var/log/nginx

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove default nginx pid path config
RUN sed -i '/pid/d' /etc/nginx/nginx.conf

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/server /app/server
COPY --from=build /app/package*.json /app/

# Set working directory
WORKDIR /app

# Install production dependencies
RUN npm ci --production

# Start command
CMD ["sh", "-c", "nginx -g 'daemon off;' & NODE_ENV=production node server/index.js"]