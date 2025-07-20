window.TelegramExporter.utils = {
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

  cleanFileName: function (name) {
    return name.replace(/[^\w\s-]/gi, "").replace(/\s+/g, "_");
  },

  getChatName: function () {
    const { selectors } = window.TelegramExporter;
    try {
      const chatNameEl = document.querySelector(selectors.chatName);
      return chatNameEl ? chatNameEl.textContent.trim() : null;
    } catch (e) {
      return null;
    }
  },

  randomDelay: function () {
    const { config } = window.TelegramExporter;
    const delay = config.delayBetweenChunks + Math.random() * config.maxRandomDelay;
    return new Promise((resolve) => setTimeout(resolve, delay));
  },

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