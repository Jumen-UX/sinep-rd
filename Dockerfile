FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=10000
ENV HOSTNAME=0.0.0.0

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 10000

CMD ["npm", "start"]
