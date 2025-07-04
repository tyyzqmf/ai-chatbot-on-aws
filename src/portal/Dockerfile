FROM public.ecr.aws/docker/library/node:20 AS builder
WORKDIR /app
COPY . .
RUN npm install -g pnpm@10.2.1
RUN pnpm install && pnpm build

FROM public.ecr.aws/docker/library/node:20 AS runner
ENV PORT=8080 NODE_ENV=production
WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/run.sh ./run.sh

RUN mkdir -p .next/cache

RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/ping || exit 1

USER appuser
EXPOSE 8080

CMD ["node", "server.js"]
