FROM node:20-slim
WORKDIR /app
COPY backend-js/package*.json ./
RUN npm install --production
COPY backend-js/ ./

# Expose the backend port. This should match the PORT env variable used by
# the server (5005 by default).
EXPOSE 5005
CMD ["node", "index.js"]
