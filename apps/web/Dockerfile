FROM node:20 AS build
WORKDIR /app

# Install root dependencies so shared packages (date-fns, recharts, heroicons, etc.) are available
COPY package.json package-lock.json ./
RUN npm ci --no-audit --silent

# Install web-specific dependencies (if any) and build the web app
COPY apps/web/package.json apps/web/package-lock.json ./apps/web/
WORKDIR /app/apps/web
RUN npm ci --no-audit --silent

# Copy web sources and build
COPY apps/web/ ./
RUN npm run build

FROM node:20 AS runtime
WORKDIR /app
COPY --from=build /app/apps/web .
EXPOSE 3001
ENV NODE_ENV=production
CMD ["npx", "next", "start", "-p", "3001"]
