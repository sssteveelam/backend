# Stage 1: Build
FROM node:22-alpine AS build

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install only production dependencies
RUN npm ci --only=production

# Re-generate Prisma Client for production (ensures it's in the production node_modules)
RUN npx prisma generate

# Copy built assets from build stage
COPY --from=build /app/dist ./dist

# Environmental defaults
ENV NODE_ENV=production
EXPOSE 3000

# Start the application
# We use a shell form to allow for pre-start migrations if needed, 
# but here we'll handle migrations in the entrypoint or via compose.
CMD ["npm", "run", "start"]
