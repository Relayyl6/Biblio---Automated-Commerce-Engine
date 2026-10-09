# Use the official Node.js 24 image as the base
FROM node:24-alpine AS base
WORKDIR /app

# Install dependencies first for Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Set up environment variables
ENV NODE_ENV=production

# Expose ports that might be used by the services
# Fastify Merchant API
EXPOSE 3000
# WhatsApp Gateway (if any webhooks are exposed)
EXPOSE 3001

# Default command (can be overridden in docker-compose.yml)
CMD ["npm", "run", "merchant-api"]
