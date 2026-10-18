const express = require('express');
const prisma = require('../prisma/client');
const { hashPassword, verifyPassword, gravatarUrl } = require('../src/auth');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

router.get('/signup', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('auth/signup', { error: null, values: {} });
});

router.post('/signup', async (req, res) => {
  const username = (req.body.username || '').trim();
  const displayName = (req.body.displayName || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  const fail = (error) =>
    res.status(400).render('auth/signup', {
      error,
      values: { username, displayName, email },
    });

  if (!USERNAME_RE.test(username)) {
    return fail('Username must be 3-20 characters, letters, numbers or underscore.');
  }
  if (!displayName) return fail('Display name is required.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Enter a valid email address.');
  if (password.length < 8) return fail('Password must be at least 8 characters.');

  // Race-safe: the unique index would throw anyway, but this gives a clean message.
  const clash = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { username: true, email: true },
  });
  if (clash) {
    return fail(
      clash.username === username ? 'That username is taken.' : 'That email is already registered.'
    );
  }

  const user = await prisma.user.create({
    data: {
      username,
      displayName,
      email,
      passwordHash: await hashPassword(password),
      avatarUrl: gravatarUrl(email),
    },
    select: { id: true },
  });

  req.session.userId = user.id;
  res.redirect('/');
});

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('auth/login', { error: null, username: '' });
});

router.post('/login', async (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, passwordHash: true },
  });

  // Same message either way so the form can't be used to enumerate usernames.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).render('auth/login', { error: 'Incorrect username or password.', username });
  }

  req.session.userId = user.id;
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;