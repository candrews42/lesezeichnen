FROM node:20-alpine

WORKDIR /app

# Install dependencies for sharp
RUN apk add --no-cache python3 make g++ vips-dev

# Copy workspace files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/bot/package*.json ./packages/bot/

# Install dependencies
RUN npm install --workspace=packages/shared --workspace=packages/bot

# Copy source files
COPY packages/shared ./packages/shared
COPY packages/bot ./packages/bot
COPY tsconfig.base.json ./

# Build shared package
RUN npm run build --workspace=packages/shared

# Build bot
RUN npm run build --workspace=packages/bot

# Run the bot
CMD ["npm", "run", "start", "--workspace=packages/bot"]
