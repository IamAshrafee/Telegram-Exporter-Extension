// This file contains the core logic for processing messages into different formats.

window.TelegramExporter.processors = {
  /**
   * Processes an array of message elements into a plain text string.
   * @param {Array<HTMLElement>} messageElements - The message elements to process.
   * @returns {Promise<string>} - A promise that resolves with the processed text.
   */
  processMessagesToTXT: async function (messageElements) {
    const { config, utils } = window.TelegramExporter;
    let allText = "";

    if (config.includeExportDate) {
      allText += `=== Telegram Chat Export ===\n`;
      allText += `Export Date: ${new Date().toLocaleString()}\n\n`;
    }

    for (let i = 0; i < messageElements.length; i += config.chunkSize) {
      const chunk = Array.from(messageElements).slice(i, i + config.chunkSize);
      for (const [index, messageEl] of chunk.entries()) {
        const metadata = utils.extractMetadata(messageEl);
        const messageText = utils.cleanMessageText(messageEl);

        if (messageText) {
          allText += `=== Message ${i + index + 1} ===\n`;
          if (metadata.date) allText += `📅 Date: ${metadata.date}\n`;
          if (metadata.time) allText += `🕒 Time: ${metadata.time}\n`;
          if (metadata.sender) allText += `👤 From: ${metadata.sender}\n`;
          if (metadata.forwardedFrom)
            allText += `↩️ Forwarded from: ${metadata.forwardedFrom}\n`;

          if (config.includeMedia) {
            if (metadata.hasImage)
              allText += `🖼️ Image: ${metadata.mediaAlt || "No description"}\n`;
            if (metadata.hasVideo) allText += `🎥 Video attached\n`;
            if (metadata.hasGif) allText += `🖼️ GIF attached\n`;
            if (metadata.hasDocument)
              allText += `📄 File: ${metadata.documentName || "No name"}\n`;
            if (metadata.hasAudio) allText += `🎵 Audio attached\n`;
            if (metadata.hasSticker) allText += `🏷️ Sticker attached\n`;
          }

          allText += `💬 Content: ${messageText}\n\n`;
        }
      }
      await utils.randomDelay();
    }

    if (config.includeMessageCount) {
      allText += `\n=== Export Summary ===\n`;
      allText += `Total Messages: ${messageElements.length}\n`;
      allText += `Export Completed: ${new Date().toLocaleString()}\n`;
    }

    return allText;
  },

  /**
   * Processes an array of message elements into an HTML string.
   * @param {Array<HTMLElement>} messageElements - The message elements to process.
   * @param {string} chatName - The name of the chat.
   * @returns {Promise<string>} - A promise that resolves with the processed HTML.
   */
  processMessagesToHTML: async function (messageElements, chatName = "") {
    const { config, utils } = window.TelegramExporter;
    const messages = [];
    let participantCount = 0;
    const participants = new Set();

    for (let i = 0; i < messageElements.length; i += config.chunkSize) {
      const chunk = Array.from(messageElements).slice(i, i + config.chunkSize);
      for (const messageEl of chunk) {
        const metadata = utils.extractMetadata(messageEl);
        const messageText = utils.cleanMessageText(messageEl);

        if (messageText) {
          if (metadata.sender) participants.add(metadata.sender);
          messages.push({
            metadata,
            content: messageText,
            position: messages.length + 1,
          });
        }
      }
      await utils.randomDelay();
    }

    participantCount = participants.size;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Telegram Export: ${utils.escapeHtml(
            chatName || "Chat"
          )}</title>
          <link rel="stylesheet" href="chrome-extension://${
            chrome.runtime.id
          }/css/style.css">
      </head>
      <body>
          <div class="container">
              <header class="header">
                  <h1 class="chat-title">${utils.escapeHtml(
                    chatName || "Telegram Chat"
                  )}</h1>
                  <div class="export-info">
                      <span>Exported: ${new Date().toLocaleString()}</span>
                      <span>Format: HTML (Premium)</span>
                  </div>
                  <div class="stats">
                      <div class="stat-box">
                          <div class="stat-value">${messages.length}</div>
                          <div class="stat-label">Messages</div>
                      </div>
                      <div class="stat-box">
                          <div class="stat-value">${participantCount}</div>
                          <div class="stat-label">Participants</div>
                      </div>
                      <div class="stat-box">
                          <div class="stat-value">${new Date().toLocaleDateString()}</div>
                          <div class="stat-label">Export Date</div>
                      </div>
                  </div>
              </header>
              <main class="messages-container">
    `;

    const messagesHTML = messages
      .map((msg) => {
        let mediaHTML = "";

        if (config.includeMedia) {
          if (msg.metadata.hasImage) {
            mediaHTML = `
              <div class="message-media">
                  ${
                    config.mediaAsThumbnails && msg.metadata.mediaSrc
                      ? `<img src="${msg.metadata.mediaSrc}" alt="${
                          msg.metadata.mediaAlt || "Image"
                        }" class="media-thumbnail">`
                      : `<div class="media-placeholder">${
                          msg.metadata.mediaAlt
                            ? `${config.imagePlaceholder}: ${msg.metadata.mediaAlt}`
                            : config.imagePlaceholder
                        }</div>`
                  }
              </div>`;
          } else if (msg.metadata.hasVideo) {
            mediaHTML = `
              <div class="message-media">
                  ${
                    config.mediaAsThumbnails && msg.metadata.mediaSrc
                      ? `<video controls class="media-thumbnail"><source src="${msg.metadata.mediaSrc}" type="video/mp4">${config.videoPlaceholder}</video>`
                      : `<div class="media-placeholder">${config.videoPlaceholder}</div>`
                  }
              </div>`;
          } else if (msg.metadata.hasGif) {
            mediaHTML = `
              <div class="message-media">
                  ${
                    config.mediaAsThumbnails && msg.metadata.mediaSrc
                      ? `<img src="${msg.metadata.mediaSrc}" alt="GIF" class="media-thumbnail">`
                      : `<div class="media-placeholder">${config.gifPlaceholder}</div>`
                  }
              </div>`;
          } else if (msg.metadata.hasDocument) {
            mediaHTML = `
              <div class="message-media">
                  <div class="media-placeholder">
                      ${
                        msg.metadata.documentName
                          ? `${config.documentPlaceholder}: ${msg.metadata.documentName}`
                          : config.documentPlaceholder
                      }
                  </div>
              </div>`;
          } else if (msg.metadata.hasAudio) {
            mediaHTML = `
              <div class="message-media">
                  <div class="media-placeholder">${config.audioPlaceholder}</div>
              </div>`;
          } else if (msg.metadata.hasSticker) {
            mediaHTML = `
              <div class="message-media">
                  <div class="media-placeholder">${config.stickerPlaceholder}</div>
              </div>`;
          }
        }

        return `
          <div class="message">
              <div class="message-number">${msg.position}</div>
              <div class="message-header">
                  <div class="sender-info">
                      <span class="sender-name">${utils.escapeHtml(
                        msg.metadata.sender || "Unknown"
                      )}</span>
                  </div>
                  <div class="message-meta">
                      <span class="message-date">
                          <span>${utils.escapeHtml(
                            msg.metadata.date || "Unknown date"
                          )}</span>
                          <span>•</span>
                          <span>${utils.escapeHtml(
                            msg.metadata.time || "Unknown time"
                          )}</span>
                      </span>
                  </div>
              </div>
              ${
                msg.metadata.forwardedFrom
                  ? `<div class="forwarded-from"><span>↩️ Forwarded from ${utils.escapeHtml(
                      msg.metadata.forwardedFrom
                    )}</span></div>`
                  : ""
              }
              ${mediaHTML}
              <div class="message-content">${utils.escapeHtml(
                msg.content
              )}</div>
          </div>`;
      })
      .join("");

    const footerHTML = `
              </main>
              <footer class="footer">
                  <p>Exported using Telegram Text Exporter (Premium) • ${new Date().getFullYear()}</p>
              </footer>
          </div>
      </body>
      </html>`;

    return html + messagesHTML + footerHTML;
  },

  /**
   * Processes an array of message elements into a JSON object.
   * @param {Array<HTMLElement>} messageElements - The message elements to process.
   * @returns {Promise<object>} - A promise that resolves with the processed JSON object.
   */
  processMessagesToJSON: async function (messageElements) {
    const { config, utils } = window.TelegramExporter;
    const messages = [];
    const participants = new Set();

    for (let i = 0; i < messageElements.length; i += config.chunkSize) {
      const chunk = Array.from(messageElements).slice(i, i + config.chunkSize);
      for (const messageEl of chunk) {
        const metadata = utils.extractMetadata(messageEl);
        const messageText = utils.cleanMessageText(messageEl);

        if (messageText) {
          if (metadata.sender) participants.add(metadata.sender);
          messages.push({
            id: i + 1,
            ...metadata,
            content: messageText,
            mediaInfo: config.includeMedia
              ? {
                  hasImage: metadata.hasImage,
                  hasVideo: metadata.hasVideo,
                  hasGif: metadata.hasGif,
                  hasDocument: metadata.hasDocument,
                  hasAudio: metadata.hasAudio,
                  hasSticker: metadata.hasSticker,
                  mediaSrc: metadata.mediaSrc,
                  mediaAlt: metadata.mediaAlt,
                  documentName: metadata.documentName,
                }
              : null,
          });
        }
      }
      await utils.randomDelay();
    }

    return {
      meta: {
        exportDate: new Date().toISOString(),
        messageCount: messages.length,
        participantCount: participants.size,
        formatVersion: "2.4",
      },
      messages,
    };
  },
};
