const AUTHOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
};

// The one definition of "a post, fully loaded for display". Used by both the
// feed and the profile page so the two can never drift apart.
// `viewerId` narrows `likes` to just this user's, which is how the view knows
// whether to render the button as liked without a second query per post.
function postInclude(viewerId) {
  return {
    author: { select: AUTHOR_SELECT },
    likes: { where: { userId: viewerId }, select: { userId: true } },
    _count: { select: { likes: true, comments: true } },
    comments: {
      orderBy: { createdAt: 'asc' },
      include: { author: { select: AUTHOR_SELECT } },
    },
  };
}

module.exports = { postInclude, AUTHOR_SELECT };