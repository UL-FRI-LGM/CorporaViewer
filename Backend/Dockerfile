# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build  # <-- generates /app/dist


# Stage 2: Runtime
FROM node:20-slim

# Environment variables
ENV IP_ADDRESS=localhost
ENV PORT=3000
ENV ELASTICSEARCH_HOSTS=http://localhost:9200
ENV PATH_TO_DATA=/app/data
ENV MEETINGS_INDEX_NAME=meetings-index
ENV WORDS_INDEX_NAME=words-index
ENV SENTENCES_INDEX_NAME=sentences-index

WORKDIR /app
COPY --from=builder /app/package*.json .

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/app.js"]
