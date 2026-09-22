FROM node:20-alpine

WORKDIR /app

# Install npm dependencies first to leverage Docker layer caching
COPY package*.json ./
RUN npm install

# Copy application source code
COPY . .

EXPOSE 5173

# Start Vite development server bound to all interfaces
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
