// This file contains various utility functions used by the exporter.

window.TelegramExporter.utils = {
  /**
   * Extracts metadata from a message element.
   * @param {HTMLElement} messageEl - The message element to extract metadata from.
   * @returns {object} - An object containing the extracted metadata.
   */
  extractMetadata: function (messageEl) {
    const { config, selectors } = window.TelegramExporter;
    try {
        if (!messageEl) {
            return {};
        }
      const dateGroup = messageEl.closest(".message-date-group");
      const dateText = dateGroup
        ?.querySelector(config.dateGroupSelector)
        ?.textContent.trim();

      const forwardedFrom = messageEl
        .querySelector(config.forwardedFromSelector)
        ?.textContent.trim();
      const sender = messageEl
        .querySelector(selectors.sender)
        ?.textContent.trim();
      const avatar = messageEl.querySelector(selectors.avatar)?.src;
      const hasReactions =
        messageEl.querySelector(selectors.reactions) !== null;
      const isForwarded =
        messageEl.querySelector(selectors.forwardedIcon) !== null;

      const media = {
        hasImage: messageEl.querySelector(selectors.media.image) !== null,
        hasVideo: messageEl.querySelector(selectors.media.video) !== null,
        hasGif: messageEl.querySelector(selectors.media.gif) !== null,
        hasDocument: messageEl.querySelector(selectors.media.document) !== null,
        hasAudio: messageEl.querySelector(selectors.media.audio) !== null,
        hasSticker: messageEl.querySelector(selectors.media.sticker) !== null,
        mediaSrc:
          messageEl.querySelector(
            `${selectors.media.image}, ${selectors.media.video}, ${selectors.media.gif}`
          )?.src || null,
        mediaAlt: messageEl.querySelector(selectors.media.image)?.alt || null,
        documentName:
          messageEl
            .querySelector(selectors.media.document)
            ?.textContent.trim() || null,
      };

      return {
        sender,
        senderAvatar: avatar,
        forwardedFrom,
        isForwarded,
        date: dateText || null,
        time:
          messageEl.querySelector(selectors.time)?.textContent.trim() ||
          null,
        timestamp: null,
        hasReactions,
        messageId: messageEl.getAttribute("data-message-id") || null,
        ...media,
      };
    } catch (e) {
      console.warn(`[Telegram Exporter] Error extracting metadata: ${e}`);
      return {
        sender: null,
        forwardedFrom: null,
        date: null,
        time: null,
        timestamp: null,
        hasImage: false,
        hasVideo: false,
        hasGif: false,
        hasDocument: false,
        hasAudio: false,
        hasSticker: false,
        mediaSrc: null,
        mediaAlt: null,
        documentName: null,
      };
    }
  },

  /**
   * Cleans the text content of a message element, removing unwanted elements and formatting links.
   * @param {HTMLElement} messageEl - The message element to clean.
   * @returns {string} - The cleaned message text.
   */
  cleanMessageText: function (messageEl) {
    const { config, selectors, currentExportFormat } = window.TelegramExporter;
    const isHtmlExport = currentExportFormat === 'html';

    try {
      const contentEl = messageEl.querySelector(config.contentSelector);
      if (!contentEl) return null;

      const clone = contentEl.cloneNode(true);

      // Remove the MessageMeta element
      const messageMeta = clone.querySelector('.MessageMeta');
      if (messageMeta) {
        messageMeta.remove();
      }

      // Handle custom emojis by replacing them with their alt text
      const customEmojis = clone.querySelectorAll('.custom-emoji, .emoji');
      customEmojis.forEach(emoji => {
        const altText = emoji.getAttribute('data-alt') || '';
        emoji.replaceWith(document.createTextNode(altText));
      });

      // Add line breaks after bold elements
      const boldElements = clone.querySelectorAll('strong[data-entity-type="MessageEntityBold"]');
      boldElements.forEach(strong => {
        strong.after(document.createElement('br'));
      });

      const unwantedElements = clone.querySelectorAll(
        ".Reactions, .message-action-buttons, .CommentButton, .quick-reaction, canvas, .reply-markup"
      );
      unwantedElements.forEach((el) => el.remove());

      let mediaPlaceholders = [];
      if (config.includeMedia) {
        // Media handling logic remains the same
      }

      if (isHtmlExport) {
        // HTML Export: Preserve links, add target="_blank", and linkify URLs
        const links = clone.querySelectorAll('a');
        links.forEach(link => {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });

        const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        const textNodes = [];
        const treeWalker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
        while (treeWalker.nextNode()) {
            if (treeWalker.currentNode.parentElement.tagName !== 'A') {
                textNodes.push(treeWalker.currentNode);
            }
        }

        textNodes.forEach(node => {
            const text = node.nodeValue;
            if (!urlRegex.test(text)) return;

            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            text.replace(urlRegex, (match, url, offset) => {
                if (offset > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, offset)));
                }
                const a = document.createElement('a');
                a.href = url;
                a.textContent = url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                fragment.appendChild(a);
                lastIndex = offset + match.length;
            });
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }
            node.parentNode.replaceChild(fragment, node);
        });

        return clone.innerHTML.trim();
      } else {
        // TXT/JSON Export: Convert links to markdown-style text
        const links = clone.querySelectorAll(config.linkSelector);
        links.forEach((link) => {
          const url =
            link.getAttribute("href") || link.getAttribute("title") || "";
          const linkText = link.textContent.trim();

          let replacement;

          if (
            linkText.toLowerCase() === "click" ||
            linkText.toLowerCase() === "click here" ||
            linkText.toLowerCase() === "clickhere"
          ) {
              replacement = `[${linkText}](${url})`;
          } else if (linkText !== url) {
            replacement = `[${linkText}](${url})`;
          } else {
            replacement = url;
          }

          link.replaceWith(document.createTextNode(replacement));
        });

        let text = '';
        const childNodes = Array.from(clone.childNodes);

        childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'BR') {
              text += '\n';
            } else {
              text += node.textContent;
            }
          }
        });

        if (mediaPlaceholders.length > 0) {
          text += `\n[${mediaPlaceholders.join(", ")}]`;
        }

        return text.trim();
      }
    } catch (e) {
      console.warn(`[Telegram Exporter] Error cleaning message text: ${e}`);
      return null;
    }
  },

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
    const { config, selectors } = window.TelegramExporter;
    return new Promise((resolve) => {
      let scrollAttempts = 0;
      const scrollInterval = setInterval(() => {
        const messageList = document.querySelector(selectors.messageList);
        if (!messageList) {
          clearInterval(scrollInterval);
          resolve();
          return;
        }

        const prevScrollHeight = messageList.scrollHeight;
        messageList.scrollTop = 0;

        setTimeout(() => {
            if (messageList.scrollTop === 0) {
                messageList.scrollTop = messageList.scrollHeight;
            }

            scrollAttempts++;
            if (
              scrollAttempts >= config.maxScrollAttempts ||
              prevScrollHeight === messageList.scrollHeight
            ) {
              clearInterval(scrollInterval);
              resolve();
            }
        }, 500);
      }, config.autoScrollInterval);
    });
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
