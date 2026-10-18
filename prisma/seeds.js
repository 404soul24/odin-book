// Fills the database with fake users and everything hanging off them.
// Run with: npm run seed  (or: npx prisma db seed)
const { faker } = require('@faker-js/faker');
const prisma = require('./client');
const { hashPassword, gravatarUrl } = require('../src/auth');

const USER_COUNT = 20;
const POSTS_PER_USER = 3;

const WORDS = [
  'Finally got the build passing.',
  'Anyone else find the new layout confusing?',
  'Coffee then straight into the refactor.',
  'Spent four hours on what turned out to be a typo.',
  'The docs are good but the examples are from 2019.',
  'Rewrote it. It is worse. Reverting tomorrow.',
  'That bug was the cache all along.',
  'Shipping on Friday, as is tradition.',
  'Reading someone else’s code is a skill.',
  'This is the part of the project nobody warned me about.',
  'Tide is out so I am out too.',
  'Made a thing. It only works on my machine. Progress.',
  'Third rewrite. Diagrams help more than they admit.',
  'The tests passed yesterday. I do not trust them.',
  'Learned more from the stack trace than the tutorial.',
  'Naming things is genuinely the hardest part.',
  'Finally understand what that callback was doing.',
  'Took the long way round. Would do it again, allegedly.',
  'Turns out the bug was in my test.',
  'Good code, bad week.',
];

async function main() {
  // Order matters: children reference parents, so wipe in reverse.
  await prisma.$transaction([
    prisma.like.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.follow.deleteMany(),
    prisma.post.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  console.log('Cleared existing data.');

  const passwordHash = await hashPassword('password123');

  const users = [];
  for (let i = 0; i < USER_COUNT; i++) {
    const first = faker.person.firstName().toLowerCase().replace(/[^a-z]/g, '');
    const last = faker.person.lastName().toLowerCase().replace(/[^a-z]/g, '');
    const username = `${first}.${last}${i}`;
    const email = faker.internet.email({ firstName: first, lastName: `${last}${i}` });
    users.push(
      await prisma.user.create({
        data: {
          username,
          email,
          displayName: faker.person.fullName(),
          passwordHash,
          avatarUrl: gravatarUrl(email),
          createdAt: faker.date.recent({ days: 90 }),
        },
      })
    );
  }
  console.log(`Created ${users.length} users (password for all: password123)`);

  // Create one logged-in-able account with a predictable name.
  const demo = await prisma.user.create({
    data: {
      username: 'you',
      email: 'you@example.com',
      displayName: 'You',
      passwordHash,
      avatarUrl: gravatarUrl('you@example.com'),
    },
  });

  const authors = [...users, demo];
  const pick = (arr) => arr[faker.number.int({ min: 0, max: arr.length - 1 })];

  // A third of follow requests stay pending so there is something to accept.
  for (const follower of authors) {
    for (const target of authors) {
      if (follower.id === target.id) continue;
      if (faker.number.int({ min: 1, max: 100 }) > 35) continue;

      await prisma.follow.create({
        data: {
          followerId: follower.id,
          followingId: target.id,
          status: faker.number.int({ min: 1, max: 100 }) <= 15 ? 'pending' : 'accepted',
        },
      });
    }
  }
  console.log('Created follow requests.');

  let postCount = 0;
  for (const author of authors) {
    for (let i = 0; i < POSTS_PER_USER; i++) {
      const post = await prisma.post.create({
        data: {
          content: pick(WORDS),
          authorId: author.id,
          createdAt: faker.date.recent({ days: 30 }),
        },
      });
      postCount++;

      for (const liker of authors) {
        if (liker.id !== author.id && faker.number.int({ min: 1, max: 100 }) <= 45) {
          await prisma.like.create({ data: { userId: liker.id, postId: post.id } });
        }
      }

      for (const commenter of authors) {
        if (commenter.id !== author.id && faker.number.int({ min: 1, max: 100 }) <= 30) {
          await prisma.comment.create({
            data: { content: pick(WORDS), postId: post.id, authorId: commenter.id },
          });
        }
      }
    }
  }
  console.log(`Created ${postCount} posts with likes and comments.`);
  console.log('\nSign in with: you / password123');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());