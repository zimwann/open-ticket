# Docker File for Open Ticket v4
FROM node:22-alpine

# /home/container keeps Pterodactyl panel compatibility
WORKDIR /home/container

# Install dependencies
COPY --chown=node:node package*.json ./
RUN npm install

# Copy app source
COPY --chown=node:node . .

ENV NODE_ENV=production

# Run as the built-in non-root node user
USER node

CMD ["node", "index.js"]
