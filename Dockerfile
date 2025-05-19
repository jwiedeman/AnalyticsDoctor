FROM node:20-slim
WORKDIR /app
COPY backend-js/package*.json ./
RUN npm install --production
COPY backend-js/ ./
EXPOSE 5005
CMD ["node", "index.js"]
