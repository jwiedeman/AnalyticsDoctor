FROM node:20-slim
WORKDIR /app
COPY backend-js/package*.json ./

# Install system Chromium and install Node dependencies without
# downloading Puppeteer's bundled browser. This avoids architecture
# mismatches when running on ARM hosts.
RUN apt-get update && \
    apt-get install -y chromium && \
    rm -rf /var/lib/apt/lists/* && \
    PUPPETEER_SKIP_DOWNLOAD=1 npm install --production

COPY backend-js/ ./

# Use the system Chromium installed above
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Expose the backend port. This should match the PORT env variable used by
# the server (5005 by default).
EXPOSE 5005
CMD ["node", "index.js"]
