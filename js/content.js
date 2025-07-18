// This is the main content script for the extension.
// It orchestrates the other modules to provide the export functionality.

(function () {
  "use strict";

  // Destructure the modules from the global TelegramExporter object.
  const { config, dom, processors, utils } = window.TelegramExporter;

  // A simple logger for development.
  const logger = {
    log: (message) => console.log(`[Telegram Exporter] ${message}`),
    info: (message) =>
      console.info(`%c[Telegram Exporter] ${message}`, "color: #3498db"),
    success: (message) =>
      console.log(`%c[Telegram Exporter] ${message}`, "color: #2ecc71"),
    error: (message) =>
      console.error(`%c[Telegram Exporter] ${message}`, "color: #e74c3c"),
    warn: (message) =>
      console.warn(`%c[Telegram Exporter] ${message}`, "color: #f39c12"),
  };

  /**
   * The main export function.
   * @param {string} format - The format to export to (txt, html, or json).
   */
  async function exportMessages(format = "txt") {
    window.TelegramExporter.currentExportFormat = format;
    try {
      dom.showLoading(true, `Preparing ${format.toUpperCase()} export...`);
      const chatName = utils.getChatName();
      const fileName = `telegram_${format}_${utils.cleanFileName(
        chatName || "chat"
      )}_${new Date().toISOString().slice(0, 10)}`;

      // Scroll to the top of the chat to load all messages.
      await utils.autoScrollToLoadMessages();
      const messageElements = document.querySelectorAll(config.messageSelector);

      if (messageElements.length === 0) {
        dom.showAlert("No messages found!", "warning");
        return;
      }

      dom.showLoading(true, `Processing ${messageElements.length} messages...`);
      let exportedData;

      // Process the messages based on the selected format.
      switch (format.toLowerCase()) {
        case "html":
          exportedData = await processors.processMessagesToHTML(
            messageElements,
            chatName
          );
          utils.downloadFile(exportedData, `${fileName}.html`, "text/html");
          break;
        case "json":
          exportedData = await processors.processMessagesToJSON(
            messageElements
          );
          utils.downloadFile(
            JSON.stringify(exportedData, null, 2),
            `${fileName}.json`,
            "application/json"
          );
          break;
        default:
          exportedData = await processors.processMessagesToTXT(messageElements);
          utils.downloadFile(exportedData, `${fileName}.txt`, "text/plain");
      }

      logger.success(
        `Exported ${
          messageElements.length
        } messages in ${format.toUpperCase()} format`
      );
      dom.showAlert(`Exported ${messageElements.length} messages!`, "success");
    } catch (error) {
      logger.error(`Export failed: ${error}`);
      dom.showAlert("Export failed! Check console for details.", "error");
    } finally {
      dom.showLoading(false);
      delete window.TelegramExporter.currentExportFormat;
    }
  }

  // Expose the exportMessages function to the global window object so it can be called from the popup.
  window.exportMessages = exportMessages;
})();
