FROM node:10-alpine
ENV NODE_ENV production
WORKDIR /usr/src/app
COPY [ "package*.json", "index.js", "config.example.js", "commonFunctions.js", "./"]
COPY src/http-content-encoding/index.js ./src/http-content-encoding/
COPY src/http-content-encoding/node_modules ./src/http-content-encoding/
RUN npm ci --production
EXPOSE 6643
CMD node index.js
