# Use Node.js official image
FROM node:18

# Create working directory inside container
WORKDIR /app

# Copy your backend files into the container
COPY . .

# Install dependencies (like express, mysql2, etc.)
RUN npm install

# Expose the port your app listens on
EXPOSE 8080

# Start the app
CMD ["node", "server.js"]
