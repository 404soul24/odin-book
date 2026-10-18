const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma/client');

const hashPassword = (password) => bcrypt.hash(password, 10);

const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

// Gravatar keys off the MD5 of the lowercased, trimmed address.
function gravatarUrl(email, size = 80) {
  const hash = crypto
    .createHash('md5')
    .update(email.trim().toLowerCase())
    .digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=mp`;
}

// Everything except /login and /signup is behind this.
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

// Runs on every request so views always know who is signed in.
async function currentUser(req, res, next) {
  res.locals.currentUser = null;
  if (req.session.userId) {
    res.locals.currentUser = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });
    // Session pointed at a deleted user.
    if (!res.locals.currentUser) req.session.userId = null;
  }
  next();
}

module.exports = { hashPassword, verifyPassword, gravatarUrl, requireLogin, currentUser };