# Step 1: Use an official Node.js image from Docker Hub
FROM node:16

# Step 2: Set the working directory inside the container
WORKDIR /app

# Step 3: Copy the package.json and package-lock.json (if present) into the container
COPY package*.json ./

# Step 4: Install the dependencies
RUN npm install --production

# Step 5: Copy the rest of the application code
COPY . .

# Step 6: Expose the port that the app will run on (default is 3000 for most Node.js apps)
EXPOSE 3000

# Step 7: Start the Node.js application
CMD ["npm", "start"]
