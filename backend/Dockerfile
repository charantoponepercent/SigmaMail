FROM node:20-alpine

RUN apk add --no-cache \
  python3 \
  make \
  g++ \
  libc6-compat

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["node", "index.js"]
