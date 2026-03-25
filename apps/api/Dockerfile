FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies (including dev so tsx is available)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --silent

COPY . .
WORKDIR /app

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npx", "tsx", "apps/api/src/index.ts"]
