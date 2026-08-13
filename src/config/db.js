const mongoose = require('mongoose');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // Fallback if environment restricts DNS setting
}

const connectDB = async () => {
  let atlasUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const localUri = 'mongodb://localhost:27017/ecommerce-db';

  if (atlasUri) {
    if (atlasUri.includes('/taskflow')) {
      atlasUri = atlasUri.replace('/taskflow', '/ecommerce-db');
    }
    try {
      const conn = await mongoose.connect(atlasUri, {
        dbName: 'ecommerce-db',
        serverSelectionTimeoutMS: 4000
      });
      console.log(`✅ [MongoDB Atlas] Connected successfully to Cloud Host: ${conn.connection.host} (Database: ${conn.connection.name})`);
      return conn;
    } catch (error) {
      console.warn(`⚠️ [MongoDB Atlas Warning]: ${error.message}`);
      console.log(`🔄 Connecting to local MongoDB fallback (${localUri}) to keep development server online...`);
    }
  }

  try {
    const conn = await mongoose.connect(localUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`✅ [MongoDB Local] Connected to Local Host: ${conn.connection.host} (Database: ${conn.connection.name})`);
    return conn;
  } catch (err) {
    console.error(`❌ [MongoDB Connection Error]: ${err.message}`);
  }
};

module.exports = connectDB;
