const mongoose = require('mongoose');
const config = require('config');
const User = require('./models/User');

const MONGO_URI = config.get('mongoURI');

async function test() {
  try {
    await mongoose.connect(MONGO_URI);
    const user = await User.findOne({ email: 'ahmadaabid0000@gmail.com' });
    console.log("Raw object from MongoDB:", user.toObject());
    console.log("User role property:", user.role);
    console.log("Is role truthy?", !!user.role);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
