const mongoose = require('mongoose');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// Trying to find MongoDB connection string
let MONGO_URI;

// Try to read from .env file if it exists
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const mongoMatch = envContent.match(/MONGO_URI=(.+)/);
    if (mongoMatch && mongoMatch[1]) {
      MONGO_URI = mongoMatch[1].trim();
      console.log('Found MongoDB URI in .env file');
    }
  }
} catch (error) {
  console.log('Could not read .env file:', error.message);
}

// If no MONGO_URI yet, try to find it in app.js or config files
if (!MONGO_URI) {
  try {
    console.log('Trying to find MongoDB connection string in application files...');
    // Use the connection string directly as a fallback
    MONGO_URI = 'mongodb://localhost:27017/edunex';
    console.log('Using default MongoDB connection: mongodb://localhost:27017/edunex');
  } catch (error) {
    console.error('Could not find MongoDB connection string:', error.message);
  }
}

if (!MONGO_URI) {
  console.error('Could not determine MongoDB connection string. Please run this script with MONGO_URI environment variable set.');
  console.error('Example: MONGO_URI=mongodb://localhost:27017/edunex node scripts/deduplicateWishlists.js');
  process.exit(1);
}

// Connect to MongoDB
console.log('Connecting to MongoDB...');
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('MongoDB Connected');
  deduplicateWishlists();
})
.catch(err => {
  console.error('Failed to connect to MongoDB:', err.message);
  process.exit(1);
});

async function deduplicateWishlists() {
  try {
    console.log('Starting wishlist deduplication process...');
    
    // Find all users with wishlists
    const users = await User.find({ wishlist: { $exists: true, $ne: [] } });
    console.log(`Found ${users.length} users with wishlist data`);
    
    let totalDuplicatesRemoved = 0;
    
    // Process each user
    for (const user of users) {
      // Convert wishlist to string array for easier deduplication
      const wishlistIds = user.wishlist.map(id => id.toString());
      
      // Create a Set to remove duplicates
      const uniqueIds = [...new Set(wishlistIds)];
      
      // Count duplicates removed
      const duplicatesRemoved = wishlistIds.length - uniqueIds.length;
      totalDuplicatesRemoved += duplicatesRemoved;
      
      if (duplicatesRemoved > 0) {
        console.log(`User ${user.email}: Removing ${duplicatesRemoved} duplicate wishlist items`);
        
        // Update user with deduplicated wishlist
        user.wishlist = uniqueIds;
        await user.save();
      }
    }
    
    console.log('Wishlist deduplication completed!');
    console.log(`Total duplicates removed across all users: ${totalDuplicatesRemoved}`);
    
    mongoose.disconnect();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error deduplicating wishlists:', error);
    mongoose.disconnect();
    process.exit(1);
  }
} 