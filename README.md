# RTC Collab — Video Conferencing + Collaboration (MongoDB edition)

This variant uses **MongoDB (Mongoose)** for user authentication instead of SQLite.

## Quick Start

1) Install dependencies
```bash
npm install
cp .env.example .env  # then set JWT_SECRET and MONGO_URI
```

2) Ensure MongoDB is running:
- Local: `mongod --dbpath /path/to/data` (or use your OS service)
- Atlas: copy the connection string into `MONGO_URI`

3) Initialize (creates a default admin user if no users exist):
```bash
node tools/init-db.js
```

4) Run
```bash
npm run dev
# open http://localhost:3000
```

Other usage notes are the same as the original README. For production, use a managed MongoDB service (Atlas), set strong JWT secrets, and serve behind TLS.
