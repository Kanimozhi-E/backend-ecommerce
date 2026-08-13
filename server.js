const dotenv = require('dotenv');
dotenv.config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const Product = require('./src/models/Product');
const seedData = require('./src/utils/seeder');

// Connect to Database & start listener
connectDB().then(async () => {
  try {
    const count = await Product.countDocuments();
    if (count === 0) {
      console.log('[Server] Database empty. Auto-seeding initial dataset...');
      await seedData();
    }
  } catch (err) {
    console.warn('[Server] Auto-seed check skipped:', err.message);
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 [AuraCommerce Server] REST Gateway listening on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});
