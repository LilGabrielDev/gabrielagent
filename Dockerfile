FROM node:20-bookworm-slim AS build
WORKDIR /app/whatsapp-service

COPY whatsapp-service/package*.json ./
RUN npm ci

COPY whatsapp-service/tsconfig.json ./
COPY whatsapp-service/src ./src
COPY whatsapp-service/public ./public
COPY whatsapp-service/index.js ./index.js

RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app/whatsapp-service
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

COPY whatsapp-service/package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/whatsapp-service/dist ./dist
COPY --from=build /app/whatsapp-service/index.js ./index.js
COPY --from=build /app/whatsapp-service/public ./public
COPY --from=build /app/whatsapp-service/package.json ./package.json
COPY --from=build /app/whatsapp-service/tsconfig.json ./tsconfig.json

RUN mkdir -p /app/whatsapp-service/sessions
EXPOSE 3001
CMD ["node", "index.js"]
