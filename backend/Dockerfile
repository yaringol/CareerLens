FROM node:20-alpine

RUN apk add --no-cache docker-cli

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
