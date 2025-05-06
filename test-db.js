const mongoose = require('mongoose');
const User = require('./models/User');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/fashionstore', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('MongoDB connected successfully');
  
  try {
    // Test query with findById
    const user1 = await User.findById('680fe1a444c5c81807b01585');
    console.log('User found by findById:', user1 ? 'Yes' : 'No');
    if (user1) console.log('User details:', user1.email, user1.name);
    
    // Test query with findOne
    const user2 = await User.findOne({ _id: '680fe1a444c5c81807b01585' });
    console.log('User found by findOne _id:', user2 ? 'Yes' : 'No');

    // Try with ObjectId format
    const objectId = new mongoose.Types.ObjectId('680fe1a444c5c81807b01585');
    const user3 = await User.findById(objectId);
    console.log('User found by ObjectId:', user3 ? 'Yes' : 'No');
    
    // List all users
    const allUsers = await User.find().select('_id email');
    console.log('All users in database:');
    allUsers.forEach(u => console.log(`ID: ${u._id}, Email: ${u.email}`));
  } catch (error) {
    console.error('Error:', error);
  }
  
  // Close the connection
  mongoose.disconnect();
})
.catch(err => {
  console.error('MongoDB connection error:', err);
}); 