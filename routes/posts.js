const express = require('express');
const prisma = require('../prisma/client');
const { requireLogin } = require('../src/auth');
const { postInclude } = require('../src/posts');

const router = express.Router();
router.use(requireLogin);

const REDIRECT = (req) => req.get('Referrer') || '/';

// Feed: the signed-in user's own posts plus everyone they actually follow.
router.get('/', async (req, res) => {
  const me = res.locals.currentUser;

  const following = await prisma.follow.findMany({
    where: { followerId: me.id, status: 'accepted' },
    select: { followingId: true },
  });

  const [posts, pendingRequests] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: { in: [me.id, ...following.map((f) => f.followingId)] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: postInclude(me.id),
    }),
    // Without a way to accept requests the feed could never fill up.
    prisma.follow.findMany({
      where: { followingId: me.id, status: 'pending' },
      select: {
        id: true,
        follower: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    }),
  ]);

  res.render('index', { posts, pendingRequests });
});

router.post('/posts', async (req, res) => {
  const content = (req.body.content || '').trim();
  if (content) {
    await prisma.post.create({
      data: { content, authorId: res.locals.currentUser.id },
    });
  }
  res.redirect(REDIRECT(req));
});

// Toggle: a second click on the same post removes the like.
router.post('/posts/:id/like', async (req, res) => {
  const key = { userId_postId: { userId: res.locals.currentUser.id, postId: Number(req.params.id) } };

  const existing = await prisma.like.findUnique({ where: key });
  if (existing) {
    await prisma.like.delete({ where: key });
  } else {
    await prisma.like.create({ data: { userId: res.locals.currentUser.id, postId: key.userId_postId.postId } });
  }
  res.redirect(REDIRECT(req));
});

router.post('/posts/:id/comment', async (req, res) => {
  const content = (req.body.content || '').trim();
  if (content) {
    await prisma.comment.create({
      data: { content, postId: Number(req.params.id), authorId: res.locals.currentUser.id },
    });
  }
  res.redirect(REDIRECT(req));
});

module.exports = router;