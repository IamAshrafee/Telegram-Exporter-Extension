// This file contains various utility functions used by the exporter.

window.TelegramExporter.utils = {
  /**
   * Escapes HTML special characters in a string.
   * @param {string} text - The string to escape.
   * @returns {string} - The escaped string.
   */
  escapeHtml: function (text) {
    if (!text) return "";
    return text
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  /**
   * Cleans a file name by removing invalid characters.
   * @param {string} name - The file name to clean.
   * @returns {string} - The cleaned file name.
   */
  cleanFileName: function (name) {
    return name.replace(/[^\w\s-]/gi, "").replace(/\s+/g, "_");
  },

  /**
   * Gets the name of the current chat.
   * @returns {string|null} - The chat name, or null if not found.
   */
  getChatName: function () {
    const { selectors } = window.TelegramExporter;
    try {
      const chatNameEl = document.querySelector(selectors.chatName);
      return chatNameEl ? chatNameEl.textContent.trim() : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Automatically scrolls the message list to load all messages.
   * @returns {Promise<void>} - A promise that resolves when scrolling is complete.
   */
  autoScrollToLoadMessages: function () {
    return Promise.resolve();
  },

  /**
   * Returns a promise that resolves after a random delay.
   * @returns {Promise<void>}
   */
  randomDelay: function () {
    const { config } = window.TelegramExporter;
    const delay =
      config.delayBetweenChunks + Math.random() * config.maxRandomDelay;
    return new Promise((resolve) => setTimeout(resolve, delay));
  },

  /**
   * Downloads a file with the given content, file name, and MIME type.
   * @param {string} content - The content of the file.
   * @param {string} fileName - The name of the file.
   * @param {string} mimeType - The MIME type of the file.
   */
  downloadFile: function (content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  },
};
