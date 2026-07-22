FROM node:18-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/runtime /app/data/radiographic-files

EXPOSE 8081

CMD ["sh", "-c", "node prepareContainerConnectionProfile.js && exec node index.js"]
