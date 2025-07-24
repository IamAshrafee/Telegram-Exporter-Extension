// Create a single global object to hold all extension-related code.
// This avoids polluting the global namespace and prevents conflicts with the host page's scripts.
window.TelegramExporter = {};

// Configuration object for the exporter.
// These values can be tweaked to change the behavior of the script.
window.TelegramExporter.config = {
  // Enhanced performance settings for large channels
  chunkSize: 50, // Reduced for better memory management
  batchSize: 20, // Process messages in smaller batches
  delayBetweenChunks: 300, // Reduced delay for faster processing
  maxRandomDelay: 500, // Reduced random delay
  
  // Intelligent scrolling configuration
  autoScrollInterval: 150,
  maxScrollAttempts: 300, // Increased for very large chats
  scrollChunkSize: 800, // Optimized scroll distance
  scrollDelay: 600, // Adaptive scroll delay
  adaptiveScrolling: true, // Enable adaptive scrolling based on network speed
  
  // Network and timing optimizations
  delayBetweenMessages: 200, // Reduced for faster processing
  maxRetryAttempts: 3, // Retry failed message loads
  networkTimeout: 5000, // Timeout for network operations
  
  // Memory management
  memoryCleanupInterval: 100, // Clean up every 100 messages
  maxMessagesInMemory: 1000, // Limit messages in memory
  enableMemoryOptimization: true,
  
  // Viewport management
  viewportBuffer: 5, // Number of screens to keep in viewport
  lazyLoadThreshold: 10, // Messages to load ahead
  
  // Error handling and recovery
  enableErrorRecovery: true,
  maxConsecutiveErrors: 5,
  errorRecoveryDelay: 2000,
  
  // Progress tracking
  progressUpdateInterval: 10, // Update progress every N messages
  
  // The format to use for links in the exported text.
  linkFormat: "[{text}]({url})",
  // Whether to merge adjacent links into a single link.
  mergeAdjacentLinks: true,
  // Whether to include a count of exported messages in the output.
  includeMessageCount: true,
  // Whether to include the export date in the output.
  includeExportDate: true,
  // Whether to include media in the export.
  includeMedia: true,
  // Whether to display media as thumbnails in the HTML export.
  mediaAsThumbnails: false,
  // The maximum width of media thumbnails in the HTML export.
  maxMediaWidth: "500px",
  // Whether to include placeholder text for media.
  mediaPlaceholderText: true,
  // Placeholder text for different types of media.
  imagePlaceholder: "📷 [Image]",
  videoPlaceholder: "🎥 [Video]",
  gifPlaceholder: "🖼️ [GIF]",
  documentPlaceholder: "📄 [File]",
  audioPlaceholder: "🎵 [Audio]",
  stickerPlaceholder: "🏷️ [Sticker]",
  pollPlaceholder: "📊 [Poll]",
};

// Enhanced selectors with fallbacks for different Telegram versions
window.TelegramExporter.selectors = {
  chatName: ".chat-info .peer-title, .ChatInfo .title, .chat-title, .peer-title",
  messageList: ".messages-list, .MessageList, .messages-container",
  messageSelector: ".Message, .message",
  contentSelector: ".text-content, .message-text, .content-text",
  dateGroupSelector: ".sticky-date, .date-group, .message-date",
  sender: ".message-author, .MessageSender, .sender-title, .peer-title, .message-sender",
  time: ".message-time, .time, .timestamp",
  avatar: ".Avatar img, .avatar-media, .avatar img",
  reactions: ".Reactions, .message-reactions, .reactions-container",
  reactionButton: ".message-reaction, .reaction-button, .reaction",
  reactionStaticEmoji: ".ReactionStaticEmoji, .reaction-emoji",
  reactionCount: ".P2FqNJAi, .reaction-count, .count",
  
  // Enhanced scroll containers with multiple fallbacks
  scrollContainer: [
    ".messages-layout .scroller",
    ".messages-container .scroller", 
    ".MessageList .scroller",
    ".messages-list",
    ".chat-container .scroller",
    ".messages-wrapper"
  ],
  
  forwarded: {
    container: ".message-title, .forward-container, .forwarded",
    title: ".forward-title, .forwarded-title",
    from: ".sender-title, .forwarded-from",
  },
  reply: {
    container: ".message-subheader, .reply-container, .reply",
    text: ".embedded-text-wrapper, .reply-text, .quoted-text",
    sender: ".embedded-sender, .reply-sender, .quoted-sender",
  },
  webPagePreview: ".WebPage, .webpage-preview, .link-preview",
  media: {
    image: '.full-media[src^="blob:"], img.message-photo, .media-photo img, .photo img',
    video: "video, .media-video video, .video-player video",
    videoDuration: ".message-media-duration, .video-duration, .duration",
    gif: ".gif, .animation, .media-gif",
    document: ".File, .document, .media-document",
    documentTitle: ".file-title, .document-title, .filename",
    documentSubtitle: ".file-subtitle, .document-subtitle, .filesize",
    audio: ".audio-track, .media-audio, .audio",
    sticker: ".sticker-media, .sticker, .media-sticker",
  },
  emoji: {
    standard: "img.emoji, .emoji img",
    custom: ".custom-emoji.emoji, .custom-emoji",
  },
  poll: {
    container: ".Poll, .poll, .media-poll",
    question: ".poll-question, .question",
    type: ".poll-type, .type",
    answers: ".poll-answers, .answers",
    results: ".poll-results, .results",
    option: ".PollOption, .poll-option, .option",
    optionText: ".poll-option-text, .option-text",
    optionPercent: ".poll-option-share, .option-percent, .percentage",
    optionChosen: ".poll-option-chosen, .chosen, .selected",
  },
};
