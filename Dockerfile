FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
RUN addgroup -S app && adduser -S -G app app
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/runtime ./runtime
USER app
EXPOSE 3000
CMD ["node", "runtime/server.mjs"]
