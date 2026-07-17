FROM node:18-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ARG VITE_DATABASE_API_URL=/api/database
ARG VITE_BLOCKCHAIN_API_URL=/api/blockchain
ENV VITE_DATABASE_API_URL=${VITE_DATABASE_API_URL}
ENV VITE_BLOCKCHAIN_API_URL=${VITE_BLOCKCHAIN_API_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
