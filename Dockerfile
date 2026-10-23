# Production image: the Angular app with server-side rendering on Node. Static files and the
# SSR bundle come out of one build; nothing is compiled at runtime.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build -- --configuration production

FROM node:20-alpine
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/dist/pod-frontend ./dist/pod-frontend
USER app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost:4000/ >/dev/null || exit 1
CMD ["node", "dist/pod-frontend/server/server.mjs"]
