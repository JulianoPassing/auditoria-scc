FROM node:20-alpine

RUN apk add --no-cache tzdata

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src

RUN mkdir -p /app/data

ENV TZ=America/Sao_Paulo
ENV NODE_ENV=production

CMD ["node", "src/index.js"]
