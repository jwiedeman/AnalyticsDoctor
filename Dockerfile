FROM node:20-slim
WORKDIR /app
COPY backend-js/package*.json ./
RUN npm install --production
COPY backend-js/ ./
EXPOSE 5000
CMD ["node", "index.js"]
