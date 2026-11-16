const mongoose = require('mongoose');

async function connectToDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is required.');
  }

  await mongoose.connect(mongoUri);
  console.log('MongoDB connected successfully.');
}

module.exports = connectToDatabase;
