import mongoose from 'mongoose';

let isConnected = false;

export async function connectMongo() {
  if (isConnected) return mongoose.connection;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required to connect to MongoDB');
  }

  mongoose.set('strictQuery', true);
  mongoose.connection.on('error', (error) => {
    console.error('[MongoDB] connection error:', error);
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  isConnected = true;
  console.log('[MongoDB] connected');
  return mongoose.connection;
}
