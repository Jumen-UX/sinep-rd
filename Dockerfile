FROM node:20-alpine

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=10000
ENV HOSTNAME=0.0.0.0

COPY package*.json ./
RUN npm install --include=dev

COPY . .
RUN npm run build

ENV NODE_ENV=production

EXPOSE 10000

CMD ["npm", "start"]
