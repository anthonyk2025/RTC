import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import express from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { Server as IOServer } from 'socket.io';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet({ contentSecurityPolicy: false }));

// --- MongoDB (Mongoose) Setup ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rtc_collab';
mongoose.set('strictQuery', false);
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> console.log('Connected to MongoDB'))
  .catch(err => { console.error('MongoDB error', err); process.exit(1); });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// --- Authentication (JWT) ---
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
function signToken(user) {
  return jwt.sign({ sub: user._id, username: user.username }, JWT_SECRET, { expiresIn: '2h' });
}

// --- API Routes for Authentication ---

// --- MODIFIED: Added detailed logging to the register route ---
app.post('/api/auth/register', async (req, res) => {
    // LOG 1: See exactly what the server receives
    console.log('Received registration request for:', req.body);

    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username & password required' });

    try {
        const hash = await bcrypt.hash(password, 10);
        const user = new User({ username, password_hash: hash });
        await user.save();
        const token = signToken(user);
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
        res.json({ user: { id: user._id, username: user.username }, token });
    } catch (e) {
        // LOG 2: See the FULL error from the database
        console.error('Full registration error:', e); 
        
        if (String(e).includes('E11000')) {
             return res.status(409).json({ error: 'Username taken' });
        }
        
        // This line was redundant, the one above already logs the full error
        // console.error(e); 
        
        res.status(500).json({ error: 'Server error during registration' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username & password required' });
    const user = await User.findOne({ username }).exec();
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken(user);
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    res.json({ user: { id: user._id, username: user.username }, token });
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ ok: true });
});

// --- Static File Serving ---
app.use(express.static('public'));

// --- HTTPS/HTTP Server Creation ---
const PORT = process.env.PORT || 3000;
let server;
if (process.env.SSL_KEY && process.env.SSL_CERT && fs.existsSync(process.env.SSL_KEY) && fs.existsSync(process.env.SSL_CERT)) {
  const key = fs.readFileSync(process.env.SSL_KEY);
  const cert = fs.readFileSync(process.env.SSL_CERT);
  server = https.createServer({ key, cert }, app);
  console.log('Starting server with HTTPS.');
} else {
  server = http.createServer(app);
  console.log('Starting server with HTTP (OK for local development).');
}

// --- Socket.IO Server ---
const io = new IOServer(server, { cors: { origin: true, credentials: true } });

// Socket.io Authentication Middleware
io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Authentication token not provided'));
        const payload = jwt.verify(token, JWT_SECRET);
        socket.user = payload;
        next();
    } catch (e) {
        next(new Error('Authentication failed'));
    }
});

// --- Main Socket.IO Connection Logic ---
io.on('connection', (socket) => {
  const username = socket.user?.username;
  const room = socket.handshake.query?.room;

  if (!room) {
    console.log(`User '${username}' tried to connect without a room ID. Disconnecting.`);
    return socket.disconnect();
  }
  
  socket.join(room);
  console.log(`User '${username}' (${socket.id}) joined room '${room}'`);

  const peers = [...io.sockets.adapter.rooms.get(room) || []].filter(id => id !== socket.id);
  socket.emit('peers', peers);
  socket.to(room).emit('peer-joined', { id: socket.id, username });

  socket.on('signal', ({ to, data }) => { io.to(to).emit('signal', { from: socket.id, data }); });
  socket.on('chat', (msg) => { io.to(room).emit('chat', { from: username, msg, ts: Date.now() }); });
  socket.on('wb:draw', (data) => { socket.to(room).emit('wb:draw', data); });
  socket.on('wb:clear', () => { socket.to(room).emit('wb:clear'); });
  socket.on('file:start', (metadata) => { socket.to(room).emit('file:start', { ...metadata, from: username }); });
  socket.on('file:chunk', (data) => { socket.to(room).emit('file:chunk', data); });

  socket.on('disconnect', () => {
    console.log(`User '${username}' (${socket.id}) left room '${room}'`);
    socket.to(room).emit('peer-left', { id: socket.id });
  });
});

// --- Start the Server ---
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});