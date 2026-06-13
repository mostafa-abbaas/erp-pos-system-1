FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && cp -R node_modules /tmp/prod_modules
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=deps /tmp/prod_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
RUN mkdir -p /app/uploads && chown nestjs:nodejs /app/uploads
USER nestjs
EXPOSE 3001
CMD ["node", "dist/main"]
