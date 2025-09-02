import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/rtc_collab';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function main() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB at', uri);
  // Optionally create a default user if none exist
  const count = await User.countDocuments();
  if (count === 0) {
    const pw = 'password123';
    const hash = await bcrypt.hash(pw, 10);
    const u = new User({ username: 'admin', password_hash: hash });
    await u.save();
    console.log('Created default user: admin / password123 (change this)');
  } else {
    console.log('Users already exist, skipping default creation.');
  }
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
