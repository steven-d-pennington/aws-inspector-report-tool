FROM node:20-bullseye

WORKDIR /usr/src/app

# Install system dependencies required by the application
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production \
    PORT=3010

EXPOSE 3010

CMD ["npm", "start"]
