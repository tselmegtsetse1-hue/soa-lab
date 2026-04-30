# Lab 07 — SOAP service on Droplet (Docker Marketplace image дээр ажиллуулахад)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "server.js"]
