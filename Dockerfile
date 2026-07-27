FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js codepage.js jobpage.js ad-slot.html ./
COPY public/ ./public/
COPY data/ ./data/

ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
