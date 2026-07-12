FROM mcr.microsoft.com/playwright:v1.61.1-noble AS source

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

FROM source AS verify
RUN npm run typecheck && npm run qa:sync

FROM source AS build
RUN npm run build

FROM source AS runtime
COPY --from=build /app/dist /app/dist
ENV NODE_ENV=production
EXPOSE 4178
VOLUME ["/app/data/runtime"]
CMD ["npm", "run", "serve:shared"]
