FROM node:12-alpine

WORKDIR /home/node/app
COPY package*.json ./
RUN npm ci
COPY . ./
RUN npm run build

EXPOSE 3000
CMD ["node", "dist"]
