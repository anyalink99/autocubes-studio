FROM mcr.microsoft.com/playwright:v1.61.1-noble

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4178
VOLUME ["/app/data/runtime"]
CMD ["npm", "run", "serve:shared"]
