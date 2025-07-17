// Create a single global object to hold all extension-related code.
// This avoids polluting the global namespace and prevents conflicts with the host page's scripts.
window.TelegramExporter = {};

// Configuration object for the exporter.
// These values can be tweaked to change the behavior of the script.
window.TelegramExporter.config = {
  // The number of messages to process in each batch.
  chunkSize: 50,
  // The base delay between processing each chunk of messages.
  delayBetweenChunks: 300,
  // A random delay added to the base delay to mimic human behavior.
  maxRandomDelay: 800,
  // The interval at which to scroll the message list to load more messages.
  autoScrollInterval: 150,
  // The maximum number of scroll attempts before giving up.
  maxScrollAttempts: 25,
  // CSS selectors for identifying key elements in the Telegram web interface.
  messageSelector: ".message-list-item, .Message",
  contentSelector: ".content-inner, .content",
  dateGroupSelector: ".message-date-group .sticky-date",
  forwardedFromSelector:
    ".forward-title-container + .message-title-name .sender-title",
  linkSelector: 'a.text-entity-link, a[data-entity-type="MessageEntityUrl"]',
  // The format to use for links in the exported text.
  linkFormat: "(Click)[{url}]",
  // Whether to merge adjacent links into a single link.
  mergeAdjacentLinks: true,
  // Whether to include a count of exported messages in the output.
  includeMessageCount: true,
  // Whether to include the export date in the output.
  includeExportDate: true,
  // The default theme for the exported HTML.
  darkMode: true,
  // Whether to include media in the export.
  includeMedia: true,
  // Whether to display media as thumbnails in the HTML export.
  mediaAsThumbnails: true,
  // The maximum width of media thumbnails in the HTML export.
  maxMediaWidth: "400px",
  // Whether to include placeholder text for media.
  mediaPlaceholderText: true,
  // Placeholder text for different types of media.
  imagePlaceholder: "📷 [Image]",
  videoPlaceholder: "🎥 [Video]",
  gifPlaceholder: "🖼️ [GIF]",
  documentPlaceholder: "📄 [File]",
  audioPlaceholder: "🎵 [Audio]",
  stickerPlaceholder: "🏷️ [Sticker]",
};

// Selectors for various elements in the Telegram web interface.
window.TelegramExporter.selectors = {
  chatName: ".chat-info .chat-title, .ChatInfo .title",
  messageList: ".messages-layout, .MessageList",
  sender: ".message-author, .MessageSender",
  time: ".time, .MessageMeta time, .message-time",
  timestamp: "time[datetime]",
  avatar: ".Avatar img, .avatar-media",
  reactions: ".Reactions, .message-reactions",
  forwardedIcon: ".icon-share-filled, .forward-icon",
  media: {
    image: '.full-media[src^="blob:"], img.message-photo',
    video: "video",
    gif: ".gif, .animation",
    document: ".document-name",
    audio: ".audio-track",
    sticker: ".sticker-media",
  },
};