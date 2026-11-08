# Imagem de produção do CampusConnect (Next.js + scripts de manutenção).

FROM node:24.11-alpine3.22 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24.11-alpine3.22
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
# Usados pelos scripts de migração, criação de gestor e limpeza.
COPY --from=build /app/infra ./infra
COPY --from=build /app/models ./models
COPY --from=build /app/lib ./lib
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
