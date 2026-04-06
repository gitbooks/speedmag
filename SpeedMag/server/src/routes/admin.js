const express = require('express');
const adminAuth = require('../middleware/auth');
const pool = require('../db');

const router = express.Router();

// All admin routes require auth
router.use(adminAuth);

// GET all ideas (admin view)
router.get('/ideas', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ideas ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Admin fetch ideas error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH update idea (status, response, changelog)
router.patch('/ideas/:id', async (req, res) => {
  const { status, admin_response, changelog_url } = req.body;
  const fields = [];
  const values = [];
  let idx = 1;

  if (status !== undefined) {
    const valid = ['submitted', 'under_review', 'in_progress', 'shipped'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    fields.push(`status = $${idx++}`);
    values.push(status);
  }

  if (admin_response !== undefined) {
    fields.push(`admin_response = $${idx++}`);
    values.push(admin_response || null);
  }

  if (changelog_url !== undefined) {
    fields.push(`changelog_url = $${idx++}`);
    values.push(changelog_url || null);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  fields.push(`updated_at = NOW()`);
  values.push(req.params.id);

  try {
    const result = await pool.query(
      `UPDATE ideas SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE idea
router.delete('/ideas/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM ideas WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    res.json({ deleted: true });
  } catch (err) {
    console.error('Admin delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
