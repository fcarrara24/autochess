# --- STAGE 1: Build ---
# docker build -f docker/Dockerfile -t mia-app .

# Use an Alpine-based Node image for a smaller footprint
FROM node:24-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package files first to leverage Docker cache (won't re-install if no changes)
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN npm install --production

# Copy the rest of the source code
COPY . .

# Run the build script (assumes "build" is defined in package.json)
RUN npm run build


# --- STAGE 2: Runtime ---
FROM node:20-alpine

# Set to production mode
ENV NODE_ENV=production
WORKDIR /app

# Copy only the necessary files for running the app
COPY package*.json ./

# Install only production dependencies (no devDeps)
RUN npm ci --only=production

# Copy compiled code and assets from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server ./server

# Use a non-root user for better security
USER node

# Document the port the app listens on
EXPOSE 3000

# Start the application
# CMD ["node", "server/index.ts"]
# CMD ["npx","ts-node", "server/index.ts"]
CMD ["node", "dist/server/index.js"]