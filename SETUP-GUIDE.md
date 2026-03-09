# Perkle Backend — Setup Guide (Step by Step)

Follow this guide top to bottom. Every command, every website, every click is documented.

---

## Step 1: Prerequisites

Make sure you have these installed on your Mac:

```bash
# Check Node.js (need v18+)
node -v

# Check npm
npm -v
```

If not installed, go to **https://nodejs.org** and download the LTS version.

---

## Step 2: Create MongoDB Atlas Database (Free Tier)

1. Go to **https://www.mongodb.com/atlas** → Click **"Try Free"**
2. Sign up / Log in
3. Click **"Build a Database"** → Choose **M0 FREE** tier
4. Select region closest to you (e.g., Mumbai for India)
5. Cluster name: `perkle-cluster` → Click **"Create Deployment"**

### Create Database User:
6. Username: `perkle-admin`
7. Password: auto-generate and **SAVE IT somewhere**
8. Click **"Create Database User"**

### Allow Network Access:
9. Click **"Network Access"** in left sidebar
10. Click **"Add IP Address"** → **"Allow Access from Anywhere"** (0.0.0.0/0)
    - For production, whitelist your server's IP only
11. Click **"Confirm"**

### Get Connection String:
12. Go to **"Database"** → Click **"Connect"** on your cluster
13. Choose **"Drivers"** → Copy the connection string
14. It looks like: `mongodb+srv://perkle-admin:<password>@perkle-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority`
15. Replace `<password>` with your actual password
16. Add database name: `mongodb+srv://perkle-admin:YOUR_PASSWORD@perkle-cluster.xxxxx.mongodb.net/perkle?retryWrites=true&w=majority`

---

## Step 3: Set Up Google OAuth (Domain-Restricted Login)

1. Go to **https://console.cloud.google.com**
2. Create a new project → Name: **"Perkle"** → Click **"Create"**
3. Select the project from the top dropdown

### Enable OAuth:
4. Go to **"APIs & Services"** → **"OAuth consent screen"**
5. Choose **"Internal"** (if using Google Workspace) or **"External"**
6. Fill in:
   - App name: `Perkle`
   - User support email: your email
   - Authorized domains: add your domain (e.g., `neokred.tech`)
   - Developer contact email: your email
7. Click **"Save and Continue"**
8. Scopes → Add **email**, **profile**, **openid** → Save

### Create Credentials:
9. Go to **"APIs & Services"** → **"Credentials"**
10. Click **"+ Create Credentials"** → **"OAuth Client ID"**
11. Application type: **"Web application"**
12. Name: `Perkle Web`
13. Authorized JavaScript origins:
    - `http://localhost:5173` (dev frontend)
    - `http://localhost:3001` (dev backend)
14. Authorized redirect URIs:
    - `http://localhost:5173` (frontend handles the callback)
15. Click **"Create"**
16. **COPY** the Client ID and Client Secret — you'll need these

---

## Step 4: Copy the Project Files

Copy the entire `perkle-server` folder I created to your machine.

Your folder should look like this:

```
perkle-server/
├── prisma/
│   ├── schema.prisma
│   └── seed.js
├── src/
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── feedback.controller.js
│   │   ├── product.controller.js
│   │   ├── reply.controller.js
│   │   ├── update.controller.js
│   │   └── vote.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   └── error.middleware.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── feedback.routes.js
│   │   ├── product.routes.js
│   │   ├── reply.routes.js
│   │   ├── update.routes.js
│   │   └── vote.routes.js
│   ├── services/
│   │   └── auth.service.js
│   ├── utils/
│   │   ├── jwt.js
│   │   ├── prisma.js
│   │   └── response.js
│   └── app.js
├── .env.example
├── .gitignore
├── package.json
└── server.js
```

---

## Step 5: Install Dependencies

Open your terminal, `cd` into the project folder:

```bash
cd perkle-server

# Install all dependencies
npm install express cors cookie-parser dotenv jsonwebtoken google-auth-library @prisma/client

# Install dev dependencies
npm install -D prisma nodemon
```

---

## Step 6: Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env
```

Open `.env` in your editor and fill in the actual values:

```env
# Paste your MongoDB Atlas connection string (from Step 2)
DATABASE_URL="mongodb+srv://perkle-admin:YOUR_PASSWORD@perkle-cluster.xxxxx.mongodb.net/perkle?retryWrites=true&w=majority"

# A random secret string (generate one or make up a long string)
JWT_SECRET="kj3h4kjh5kjh345kjh345kjhdfgdfg987dfg6"
JWT_EXPIRES_IN="7d"

# From Google Cloud Console (Step 3)
GOOGLE_CLIENT_ID="xxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxx"

# Your company email domain
ALLOWED_DOMAIN="neokred.tech"

PORT=3001
NODE_ENV="development"
CLIENT_URL="http://localhost:5173"
```

---

## Step 7: Initialize Database

Run these commands in order:

```bash
# 1. Push the schema to MongoDB (creates collections)
npx prisma db push

# 2. Generate the Prisma client
npx prisma generate

# 3. Seed the database with 5 products + test users
node prisma/seed.js
```

You should see:
```
🌱 Seeding database...

  ✅ Product: Perkle
  ✅ Product: Collectbot
  ✅ Product: Approvals
  ✅ Product: Sync Engine
  ✅ Product: Settings
  ✅ Admin user: madhav@neokred.tech
  ✅ Member user: madhav@neokred.tech
  ✅ Sample update: Payment Integration on Collectbot
  ✅ Sample feedback: "New UI is good!"

🎉 Seeding complete!
```

### Verify in Prisma Studio (optional):
```bash
npx prisma studio
```
This opens a browser UI at `http://localhost:5555` where you can see all your data.

---

## Step 8: Start the Server

```bash
# Development mode (auto-restarts on file changes)
npm run dev
```

You should see:
```
  ╔══════════════════════════════════════╗
  ║                                      ║
  ║   🚀 Perkle API Server              ║
  ║                                      ║
  ║   Port:  3001                        ║
  ║   Mode:  development                 ║
  ║                                      ║
  ╚══════════════════════════════════════╝
```

---

## Step 9: Test the API

### Health Check:
Open your browser: **http://localhost:3001/api/health**

Should return:
```json
{ "status": "ok", "timestamp": "...", "uptime": 5.123 }
```

### Test with curl (or Postman/Thunder Client):

```bash
# 1. Dev Login (creates a session — DEV ONLY)
curl -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email": "madhav@neokred.tech"}' \
  -c cookies.txt

# 2. Get current user
curl http://localhost:3001/api/auth/me \
  -b cookies.txt

# 3. Get all products
curl http://localhost:3001/api/products \
  -b cookies.txt

# 4. Get updates (replace PRODUCT_ID with actual ID from products response)
curl "http://localhost:3001/api/updates?productId=PRODUCT_ID" \
  -b cookies.txt

# 5. Create a new update
curl -X POST http://localhost:3001/api/updates \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "New Dashboard Design",
    "description": "Redesigned the main dashboard with better analytics.",
    "status": "WIP",
    "productId": "PRODUCT_ID"
  }'

# 6. Vote on an update (replace UPDATE_ID)
curl -X POST http://localhost:3001/api/votes \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"updateId": "UPDATE_ID", "type": "UP"}'

# 7. Post feedback
curl -X POST http://localhost:3001/api/feedback \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "message": "Love the new payment integration!",
    "productId": "PRODUCT_ID",
    "isAnonymous": true
  }'

# 8. Reply to feedback (replace FEEDBACK_ID)
curl -X POST http://localhost:3001/api/replies \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"message": "Thanks for the feedback!", "feedbackId": "FEEDBACK_ID"}'
```

---

## Step 10: VS Code Extensions (Recommended)

Install these for the best dev experience:

| Extension | Why |
|-----------|-----|
| **Prisma** | Syntax highlighting for .prisma files |
| **Thunder Client** | API testing inside VS Code (like Postman) |
| **ESLint** | Code quality |
| **Error Lens** | Inline error display |
| **GitLens** | Git integration |

---

## API Reference Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/google` | ❌ | Google OAuth login |
| POST | `/api/auth/dev-login` | ❌ | Dev-only email login |
| GET | `/api/auth/me` | ✅ | Get current user |
| POST | `/api/auth/logout` | ✅ | Logout |
| GET | `/api/products` | ✅ | List 5 products |
| GET | `/api/updates?productId&date&status` | ✅ | Get updates (filtered) |
| GET | `/api/updates/:id` | ✅ | Get single update |
| POST | `/api/updates` | ✅ | Create update |
| PUT | `/api/updates/:id` | ✅ | Edit update (owner/admin) |
| DELETE | `/api/updates/:id` | ✅ | Delete update (owner/admin) |
| POST | `/api/votes` | ✅ | Cast/toggle vote |
| DELETE | `/api/votes/:updateId` | ✅ | Remove vote |
| GET | `/api/feedback?productId` | ✅ | Get product feedback |
| POST | `/api/feedback` | ✅ | Post feedback |
| DELETE | `/api/feedback/:id` | ✅ | Delete feedback (owner/admin) |
| POST | `/api/replies` | ✅ | Reply to feedback |
| DELETE | `/api/replies/:id` | ✅ | Delete reply (owner/admin) |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ECONNREFUSED` on MongoDB | Check your `.env` DATABASE_URL, whitelist IP in Atlas |
| `Cannot find module '@prisma/client'` | Run `npx prisma generate` |
| `P2002 Unique constraint` | You're trying to create a duplicate (e.g., same email) |
| Port 3001 already in use | Kill the process: `lsof -ti:3001 \| xargs kill` |
| Google OAuth not working | Verify Client ID in `.env` matches Google Console |
| Cookies not sent | Make sure `credentials: true` in CORS and `withCredentials: true` on frontend |
