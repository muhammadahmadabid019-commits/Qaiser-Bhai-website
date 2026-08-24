const mongoose = require('mongoose');
const config = require('config');
const User = require('./models/User');

const MONGO_URI = config.get('mongoURI');

async function test() {
  try {
    await mongoose.connect(MONGO_URI);
    const user = await User.findOne({ email: 'ahmadaabid0000@gmail.com' });
    console.log("Found user:", user.email);
    console.log("Role property exact value:", user.role);
    console.log("Length of role:", user.role ? user.role.length : 'undefined');
    if (user.role) {
      console.log("Chars:", user.role.split('').map(c => c.charCodeAt(0)));
      console.log("Trim lower === admin?", user.role.trim().toLowerCase() === 'admin');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
