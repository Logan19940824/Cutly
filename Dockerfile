ARG NODE_IMAGE=node:24-alpine
FROM ${NODE_IMAGE} AS base
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --include=dev

FROM base AS production-dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS build
ENV NODE_ENV=production
COPY --from=dependencies /workspace/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=production-dependencies /workspace/node_modules ./node_modules
COPY --from=build /workspace/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /workspace/.next ./.next
COPY --from=build /workspace/prisma ./prisma
COPY --from=build /workspace/src ./src
COPY --from=build /workspace/package.json /workspace/package-lock.json /workspace/tsconfig.json ./
EXPOSE 3000
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0"]
