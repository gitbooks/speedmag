# SpeedMag.ai Website

Marketing website, public roadmap, and admin panel for SpeedMag — the QuickBooks-style bookkeeping app for Mac.

## Quick Start

### 1. Start the API server (needed for the Roadmap page)

```bash
cd SpeedMag/server
npm run dev
```

This starts the Express API on **http://localhost:3001**.

### 2. Serve the static site

You can use any static file server. The easiest option:

```bash
cd SpeedMag
python3 -m http.server 4322
```

Then open **http://localhost:4322** in your browser.

## Pages

| URL | Description |
|-----|-------------|
| `http://localhost:4322` | Main marketing site (features, pricing, download) |
| `http://localhost:4322/roadmap.html` | Public roadmap — users submit ideas and vote |
| `http://localhost:4322/admin.html` | Admin panel — manage roadmap ideas |

## Admin Login

- **Username:** `admin`
- **Password:** `speedmag`

These are set in `server/.env`. Change them there and re-run `npm run migrate` to update.

## Database Setup (first time only)

Requires PostgreSQL running locally (Postgres.app on port 5000).

```bash
# Create the database
createdb -h localhost -p 5000 speedmag_roadmap

# Install dependencies
cd SpeedMag/server
npm install

# Create tables and admin user
npm run migrate

# Populate with example ideas (optional)
npm run seed
```

## Configuration

All server config lives in `server/.env`:

```
PORT=3001
DATABASE_URL=postgresql://Michael:speedmag@localhost:5000/speedmag_roadmap
JWT_SECRET=sm-roadmap-j8k2mXp4vR9tL5nQ7wZ3
ADMIN_USERNAME=admin
ADMIN_PASSWORD=speedmag
CORS_ORIGIN=http://localhost:4322
```

## File Structure

```
SpeedMag/
├── index.html          Main marketing site
├── roadmap.html        Public roadmap wall
├── admin.html          Admin panel
├── styles.css          Shared styles (dark theme, green palette)
├── roadmap.css         Roadmap-specific styles
├── admin.css           Admin-specific styles
├── script.js           Main site JS (particles, animations)
├── roadmap.js          Roadmap JS (fetch ideas, upvote, submit)
├── admin.js            Admin JS (auth, drag-drop, edit/delete)
├── logo.png            SpeedMag logo
├── icon-1024.png       High-res app icon
├── screenshots/        App screenshots (add your own PNGs here)
│
└── server/
    ├── .env            Local config (not committed)
    ├── .env.example    Config template
    ├── package.json
    └── src/
        ├── index.js    Express app entry point
        ├── db.js       PostgreSQL connection pool
        ├── migrate.js  Create tables + admin user
        ├── seed.js     Populate example roadmap ideas
        ├── middleware/
        │   └── auth.js JWT verification
        └── routes/
            ├── ideas.js   Public API (list, submit, upvote)
            ├── admin.js   Admin API (update status, respond, delete)
            └── auth.js    Login endpoint
```

## App Screenshots

To add screenshots to the marketing site, take screenshots of SpeedMag and save them as:

```
screenshots/dashboard.png
screenshots/transactions.png
screenshots/reports.png
screenshots/import.png
```

They'll automatically appear in the "See It In Action" section on the main page.

## Deploying to Production

When ready to deploy to speedmag.ai:

1. **Static files** — Upload everything except `server/` to any static host (Vercel, Netlify, GitHub Pages, etc.)
2. **API server** — Deploy `server/` to a Node.js host (Railway, Render, Fly.io, etc.) with a PostgreSQL database
3. **Update API_BASE** — Change the `API_BASE` constant in `roadmap.js` and `admin.js` from `http://localhost:3001/api` to your production API URL
4. **Update CORS_ORIGIN** — Change `CORS_ORIGIN` in `.env` to `https://speedmag.ai`
