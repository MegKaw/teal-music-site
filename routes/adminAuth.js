const express = require('express');
const router = express.Router();


// GET /admin/login
router.get('/login', (req, res) => {
  if (req.session?.isAdmin) return res.redirect('/admin/posts');
  return res.render('admin/login', { error: null });
});

// POST /admin/login
router.post('/login', (req, res) => {
  const password = (req.body && req.body.password) || '';
  const ok = process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD;
  if (!ok) return res.status(401).render('admin/login', { error: 'パスワードが違います' });
  req.session.isAdmin = true;
  return res.redirect('/admin/posts');
});

// GET /admin/logout
router.get('/logout', (req, res) => {
  if (!req.session) return res.redirect('/admin/login');
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/admin/login');
  });
});

module.exports = router;