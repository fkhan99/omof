/** Product copy — support-first language (UI only; Firestore field names unchanged). */

export const TAB_LABELS = {
  feed: 'Your Circle',
  discover: 'Discover',
  share: 'Share',
  activity: 'Activity',
  profile: 'Profile',
} as const;

export const CONNECTIONS = {
  followers: 'Connections',
  following: 'Connected to',
  followerSingular: 'connection',
  followAction: 'Connect',
  followingAction: 'Connected',
  requestedAction: 'Requested',
  followersScreenTitle: 'Connections',
  followingScreenTitle: 'Connected to',
  noFollowers: 'No connections yet',
  noFollowing: 'Not connected to anyone yet',
  viewFollowersA11y: 'View connections',
  viewFollowingA11y: 'View who you are connected to',
} as const;

export const RESPONSES = {
  sectionTitle: (count: number) => `Responses (${count})`,
  view: (count: number) => `View ${count} responses`,
  hide: 'Hide responses',
  reply: 'Reply',
  replyPlaceholder: (username: string) => `Reply to @${username}...`,
  replyCancel: 'Cancel reply',
  loading: 'Loading responses...',
  loadError: 'Could not load responses.',
  empty: 'No responses yet. Be the first to share support.',
  placeholder: 'Add a response...',
  postButton: 'Send',
  postA11y: 'Send response',
  deleteTitle: 'Delete response',
  deleteMessage: 'Are you sure you want to delete this response?',
  profanityError: 'Please remove inappropriate language from your response.',
  addError: 'Failed to add response',
} as const;

export const FEED = {
  loading: 'Loading your circle...',
  loadError: "Couldn't load your circle.",
  emptyTitle: 'Your circle is quiet',
  emptyMessage:
    'Connect with people in Discover to see their moments here. Your own posts appear on your profile.',
  spotlightTitle: 'Community spotlight',
  spotlightSubtitle: 'Optional promoted posts — your circle feed below stays chronological.',
  connectionsTitle: 'From your connections',
  loadMore: 'Loading more...',
} as const;

export const SHARED_EXPERIENCES = {
  title: 'Shared Experiences',
  subtitle: "You're not alone. Browse real moments by how people feel.",
  moodFilterLabel: 'Browse by mood',
  loading: 'Loading shared experiences...',
  emptyTitle: 'No shared experiences yet',
  emptyMessage: 'Be the first to share something real in this mood.',
  spotlightTitle: 'Community spotlight',
  spotlightSubtitle: 'Promoted posts from the community',
  searchPlaceholder: 'Search by name or username',
  nearbyTitle: 'People in your area',
  nearbyEmpty: 'No one else in your area yet. Invite friends to join OMOF.',
  contactsTitle: 'Find friends from contacts',
  contactsHint: 'Import contacts or paste emails to find people you know on OMOF.',
  contactsImport: 'Import contacts',
  contactsSearch: 'Find on OMOF',
  contactsPasteLabel: 'Friend emails',
  contactsPastePlaceholder: 'friend@email.com, another@email.com',
  contactsNone: 'No matching accounts found for those emails.',
  growthFilter: 'Growth updates',
  allMoods: 'All',
} as const;

export const POSTS = {
  postsLabel: 'moments',
  postsSection: 'Shared moments',
  growthSection: 'Growth updates',
  growthBadge: 'Growth update',
  shareGrowthUpdate: 'Share a growth update',
  growthUpdateTitle: 'Growth update',
  growthUpdateHint: 'Share how things changed since your original moment.',
  parentMoment: 'Original moment',
  noPosts: 'No moments yet',
  noPostsOther: "This person hasn't shared anything yet.",
} as const;

export const SUPPORT = {
  reactionCount: (count: number) =>
    count === 1 ? '1 person showed support' : `${count} people showed support`,
} as const;

export const ACTIVITY = {
  commented: (text: string) => `responded: ${text}`,
  reacted: (label: string) => `showed support — "${label}"`,
  reactedGeneric: 'showed support on your post',
  follow: 'connected with you',
  followRequest: 'requested to connect',
  followAccepted: 'accepted your connection request',
  connectBack: 'Connect back',
  growthUpdate: 'shared a growth update',
} as const;

export const PROFILE = {
  storyLabel: 'About',
  privateFollowHint: 'Connect with this account to see their moments.',
  connectionsHidden: '—',
} as const;
