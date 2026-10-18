const express = require('express');
const prisma = require('../prisma/client');
const { requireLogin } = require('../src/auth');
const { postInclude, AUTHOR_SELECT } = require('../src/posts');

const router = express.Router();
router.use(requireLogin);

const REDIRECT = (req) => req.get('Referrer') || '/';

// Directory of everyone, with the right follow button already decided server-side.
router.get('/users', async (req, res) => {
  const me = res.locals.currentUser;

  const [users, mine] = await Promise.all([
    prisma.user.findMany({
      orderBy: { username: 'asc' },
      select: { id: true, ...AUTHOR_SELECT, _count: { select: { posts: true, followers: true } } },
    }),
    prisma.follow.findMany({
      where: { followerId: me.id },
      select: { followingId: true, status: true },
    }),
  ]);

  // One lookup instead of asking the DB per row.
  const byTarget = new Map(mine.map((f) => [f.followingId, f.status]));

  res.render(
    'users/index',
    users.map((u) => ({
      ...u,
      relation: u.id === me.id ? 'self' : byTarget.get(u.id) || 'none',
    }))
  );
});

// Send a request, or withdraw one that's still pending.
router.post('/users/:id/follow', async (req, res) => {
  const followingId = Number(req.params.id);
  const followerId = res.locals.currentUser.id;
  if (followingId === followerId) return res.redirect(REDIRECT(req));

  const key = { followerId_followingId: { followerId, followingId } };
  const existing = await prisma.follow.findUnique({ where: key });

  if (existing) {
    // Only pending requests can be withdrawn; an accepted follow stays.
    if (existing.status === 'pending') await prisma.follow.delete({ where: key });
  } else {
    await prisma.follow.create({ data: { followerId, followingId, status: 'pending' } });
  }
  res.redirect(REDIRECT(req));
});

router.post('/requests/:id/accept', async (req, res) => {
  // scoping by followingId stops someone accepting a request aimed at another user
  await prisma.follow.updateMany({
    where: { id: Number(req.params.id), followingId: res.locals.currentUser.id },
    data: { status: 'accepted' },
  });
  res.redirect(REDIRECT(req));
});

router.post('/requests/:id/decline', async (req, res) => {
  await prisma.follow.deleteMany({
    where: { id: Number(req.params.id), followingId: res.locals.currentUser.id },
  });
  res.redirect(REDIRECT(req));
});

router.get('/users/:username', async (req, res, next) => {
  const me = res.locals.currentUser;

  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      createdAt: true,
      _count: { select: { posts: true, followers: true, following: true } },
    },
  });
  if (!user) return next();

  const [posts, mine] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: postInclude(me.id),
    }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: me.id, followingId: user.id } },
      select: { status: true },
    }),
  ]);

  res.render('users/profile', {
    user,
    posts,
    relation: user.id === me.id ? 'self' : mine?.status || 'none',
  });
});

module.exports = router;