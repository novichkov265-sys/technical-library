FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build
FROM node:20-alpine AS server
WORKDIR /app
COPY server/package*.json ./
RUN npm install --production
COPY server/ ./
COPY --from=client-build /app/client/dist ./public
RUN mkdir -p uploads backups
EXPOSE 5000
CMD ["node", "src/app.js"]