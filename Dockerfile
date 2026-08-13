FROM node:18-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose server port
EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

# Start Node.js Express server gateway
CMD ["node", "server.js"]
