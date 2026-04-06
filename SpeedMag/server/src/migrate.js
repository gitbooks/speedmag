const pool = require('./db');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: __dirname + '/../.env' });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ideas (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        author_name VARCHAR(100),
        status VARCHAR(20) NOT NULL DEFAULT 'submitted'
          CHECK (status IN ('submitted', 'under_review', 'in_progress', 'shipped')),
        upvote_count INTEGER NOT NULL DEFAULT 0,
        admin_response TEXT,
        changelog_url VARCHAR(500),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS upvotes (
        id SERIAL PRIMARY KEY,
        idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
        voter_fingerprint VARCHAR(64) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(idea_id, voter_fingerprint)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ideas_created ON ideas(created_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_upvotes_idea ON upvotes(idea_id);`);

    // Create default admin user
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'changeme';
    const hash = await bcrypt.hash(password, 10);

    await client.query(`
      INSERT INTO admin_users (username, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (username) DO UPDATE SET password_hash = $2;
    `, [username, hash]);

    await client.query('COMMIT');
    console.log('Migration complete. Admin user created/updated.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
