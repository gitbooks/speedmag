const express = require('express');
const crypto = require('crypto');
const pool = require('../db');

const router = express.Router();

// GET all ideas
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM ideas';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY upvote_count DESC, created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch ideas error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET single idea
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ideas WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Fetch idea error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST new idea
router.post('/', async (req, res) => {
  const { title, description, author_name } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }
  if (title.length > 200) {
    return res.status(400).json({ error: 'Title must be under 200 characters' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO ideas (title, description, author_name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [title.trim(), description.trim(), author_name?.trim() || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create idea error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST upvote
router.post('/:id/upvote', async (req, res) => {
  const ideaId = req.params.id;
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const fingerprint = crypto.createHash('sha256').update(ip + ua).digest('hex');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check idea exists
    const idea = await client.query('SELECT id FROM ideas WHERE id = $1', [ideaId]);
    if (idea.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Idea not found' });
    }

    // Try inserting upvote
    await client.query(
      'INSERT INTO upvotes (idea_id, voter_fingerprint) VALUES ($1, $2)',
      [ideaId, fingerprint]
    );

    // Increment count
    const result = await client.query(
      'UPDATE ideas SET upvote_count = upvote_count + 1, updated_at = NOW() WHERE id = $1 RETURNING upvote_count',
      [ideaId]
    );

    await client.query('COMMIT');
    res.json({ upvote_count: result.rows[0].upvote_count });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') { // unique constraint violation
      return res.status(409).json({ error: 'Already voted' });
    }
    console.error('Upvote error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
