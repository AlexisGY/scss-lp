FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit
COPY public ./public
COPY scss ./scss
COPY src ./src
ENV HOST=0.0.0.0
EXPOSE 3000
USER node
CMD ["node", "src/server.mjs"]
