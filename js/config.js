// Create a single global object to hold all extension-related code.
// This avoids polluting the global namespace and prevents conflicts with the host page's scripts.
window.TelegramExporter = {};

// Configuration object for the exporter.
// These values can be tweaked to change the behavior of the script.
window.TelegramExporter.config = {
  // The number of messages to process in each batch.
  chunkSize: 100,
  // The base delay between processing each chunk of messages.
  delayBetweenChunks: 500,
  // A random delay added to the base delay to mimic human behavior.
  maxRandomDelay: 1000,
  // The interval at which to scroll the message list to load more messages.
  autoScrollInterval: 200,
  // The maximum number of scroll attempts before giving up.
  maxScrollAttempts: 150, // Increased for long chats
  scrollChunkSize: 600, // Pixels to scroll each step
  scrollDelay: 800, // ms between scrolls
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

// Selectors for various elements in the Telegram web interface.
window.TelegramExporter.selectors = {
  chatName: ".chat-info .peer-title, .ChatInfo .title",
  messageList: ".messages-list, .MessageList",
  messageSelector: ".Message",
  contentSelector: ".text-content",
  dateGroupSelector: ".sticky-date",
  sender: ".message-author, .MessageSender, .sender-title",
  time: ".message-time",
  avatar: ".Avatar img, .avatar-media",
  reactions: ".Reactions, .message-reactions",
  reactionButton: ".message-reaction",
  reactionStaticEmoji: ".ReactionStaticEmoji",
  reactionCount: ".P2FqNJAi",
  forwarded: {
    container: ".message-title",
    title: ".forward-title",
    from: ".sender-title",
  },
  reply: {
    container: ".message-subheader",
    text: ".embedded-text-wrapper",
    sender: ".embedded-sender",
  },
  webPagePreview: ".WebPage",
  media: {
    image: '.full-media[src^="blob:"], img.message-photo',
    video: "video",
    videoDuration: ".message-media-duration",
    gif: ".gif, .animation",
    document: ".File",
    documentTitle: ".file-title",
    documentSubtitle: ".file-subtitle",
    audio: ".audio-track",
    sticker: ".sticker-media",
  },
  emoji: {
    standard: "img.emoji",
    custom: ".custom-emoji.emoji",
  },
  poll: {
    container: ".Poll",
    question: ".poll-question",
    type: ".poll-type",
    answers: ".poll-answers",
    results: ".poll-results",
    option: ".PollOption",
    optionText: ".poll-option-text",
    optionPercent: ".poll-option-share",
    optionChosen: ".poll-option-chosen",
  },
};
