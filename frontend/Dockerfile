FROM node:18-alpine

WORKDIR /app

# Install dependencies only when needed
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start development server
CMD ["pnpm", "dev"]
