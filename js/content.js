
(function () {
  "use strict";

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

  const config = {
    chunkSize: 50,
    delayBetweenChunks: 300,
    maxRandomDelay: 800,
    autoScrollInterval: 150,
    maxScrollAttempts: 25,
    messageSelector: ".message-list-item, .Message",
    contentSelector: ".content-inner, .content",
    dateGroupSelector: ".message-date-group .sticky-date",
    forwardedFromSelector:
      ".forward-title-container + .message-title-name .sender-title",
    linkSelector: 'a.text-entity-link, a[data-entity-type="MessageEntityUrl"]',
    linkFormat: "(Click)[{url}]",
    mergeAdjacentLinks: true,
    includeMessageCount: true,
    includeExportDate: true,
    darkMode: true,
    includeMedia: true,
    mediaAsThumbnails: true,
    maxMediaWidth: "400px",
    mediaPlaceholderText: true,
    imagePlaceholder: "📷 [Image]",
    videoPlaceholder: "🎥 [Video]",
    gifPlaceholder: "🖼️ [GIF]",
    documentPlaceholder: "📄 [File]",
    audioPlaceholder: "🎵 [Audio]",
    stickerPlaceholder: "🏷️ [Sticker]",
  };

  const selectors = {
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

  async function exportMessages(format = "txt") {
    try {
      showLoading(true, `Preparing ${format.toUpperCase()} export...`);
      const chatName = getChatName();
      const fileName = `telegram_${format}_${cleanFileName(
        chatName || "chat"
      )}_${new Date().toISOString().slice(0, 10)}`;

      await autoScrollToLoadMessages();
      const messageElements = document.querySelectorAll(config.messageSelector);

      if (messageElements.length === 0) {
        showAlert("No messages found!", "warning");
        return;
      }

      showLoading(true, `Processing ${messageElements.length} messages...`);
      let exportedData;

      switch (format.toLowerCase()) {
        case "html":
          exportedData = await processMessagesToHTML(messageElements, chatName);
          downloadFile(exportedData, `${fileName}.html`, "text/html");
          break;
        case "json":
          exportedData = await processMessagesToJSON(messageElements);
          downloadFile(
            JSON.stringify(exportedData, null, 2),
            `${fileName}.json`,
            "application/json"
          );
          break;
        default:
          exportedData = await processMessagesToTXT(messageElements);
          downloadFile(exportedData, `${fileName}.txt`, "text/plain");
      }

      logger.success(
        `Exported ${
          messageElements.length
        } messages in ${format.toUpperCase()} format`
      );
      showAlert(`Exported ${messageElements.length} messages!`, "success");
    } catch (error) {
      logger.error(`Export failed: ${error}`);
      showAlert("Export failed! Check console for details.", "error");
    } finally {
      showLoading(false);
    }
  }

  function showLoading(show, text = "") {
    let loader = document.getElementById("telegram-export-loader");
    if (show) {
      if (!loader) {
        loader = document.createElement("div");
        loader.id = "telegram-export-loader";
        loader.innerHTML = `
                    <div class="loader-container">
                        <div class="spinner"></div>
                        <div class="loader-text">${text}</div>
                    </div>
                `;
        document.body.appendChild(loader);
      }
      if (text) {
        loader.querySelector(".loader-text").textContent = text;
      }
      loader.style.display = "flex";
    } else if (loader) {
      loader.style.display = "none";
    n}
  }

  function showAlert(message, type = "info") {
    const alert = document.createElement("div");
    alert.className = `telegram-exporter-alert ${type}`;
    alert.textContent = message;
    document.body.appendChild(alert);

    setTimeout(() => {
      alert.style.opacity = "0";
      setTimeout(() => alert.remove(), 300);
    }, 3000);
  }

  function extractMetadata(messageEl) {
    try {
      const dateGroup = messageEl.closest(".message-date-group");
      const dateText = dateGroup
        ?.querySelector(config.dateGroupSelector)
        ?.textContent.trim();

      const timestampEl = messageEl.querySelector(selectors.timestamp);
      const messageDate = timestampEl
        ? new Date(timestampEl.getAttribute("datetime"))
        : null;

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
        date: messageDate?.toLocaleDateString() || dateText || null,
        time:
          messageDate?.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }) ||
          messageEl.querySelector(selectors.time)?.textContent.trim() ||
          null,
        timestamp: messageDate?.toISOString() || null,
        hasReactions,
        messageId: messageEl.getAttribute("data-message-id") || null,
        ...media,
      };
    } catch (e) {
      logger.warn(`Error extracting metadata: ${e}`);
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
  }

  function cleanMessageText(messageEl) {
    try {
      const contentEl = messageEl.querySelector(config.contentSelector);
      if (!contentEl) return null;

      const clone = contentEl.cloneNode(true);
      const unwantedElements = clone.querySelectorAll(
        ".Reactions, .message-action-buttons, .CommentButton, .quick-reaction, canvas, .reply-markup"
      );
      unwantedElements.forEach((el) => el.remove());

      let mediaPlaceholders = [];
      if (config.includeMedia) {
        const images = clone.querySelectorAll(selectors.media.image);
        images.forEach((img) => {
          mediaPlaceholders.push(
            `${config.imagePlaceholder}${img.alt ? ` (${img.alt})` : ""}`
          );
          img.remove();
        });

        const videos = clone.querySelectorAll(selectors.media.video);
        videos.forEach((video) => {
          mediaPlaceholders.push(config.videoPlaceholder);
          video.remove();
        });

        const gifs = clone.querySelectorAll(selectors.media.gif);
        gifs.forEach((gif) => {
          mediaPlaceholders.push(config.gifPlaceholder);
          gif.remove();
        });

        const docs = clone.querySelectorAll(selectors.media.document);
        docs.forEach((doc) => {
          const name = doc.textContent.trim();
          mediaPlaceholders.push(
            `${config.documentPlaceholder}${name ? `: ${name}` : ""}`
          );
          doc.remove();
        });

        const audio = clone.querySelectorAll(selectors.media.audio);
        audio.forEach((a) => {
          mediaPlaceholders.push(config.audioPlaceholder);
          a.remove();
        });

        const stickers = clone.querySelectorAll(selectors.media.sticker);
        stickers.forEach((sticker) => {
          mediaPlaceholders.push(config.stickerPlaceholder);
          sticker.remove();
        });
      }

      const links = clone.querySelectorAll(config.linkSelector);
      links.forEach((link) => {
        const url =
          link.getAttribute("href") || link.getAttribute("title") || "";
        const linkText = link.textContent.trim();

        let replacement;

        if (
          linkText.toLowerCase() === "click" ||
          linkText.toLowerCase() === "click here"
        ) {
          const prevSibling = link.previousSibling;
          const prevText =
            prevSibling?.nodeType === Node.TEXT_NODE
              ? prevSibling.textContent.trim()
              : "";

          if (config.mergeAdjacentLinks && prevText) {
            replacement = `${prevText} ${config.linkFormat.replace(
              "{url}",
              url
            )}`;
            if (prevSibling) prevSibling.remove();
          } else {
            replacement = config.linkFormat.replace("{url}", url);
          }
        } else if (linkText !== url) {
          replacement = `[${linkText}](${url})`;
        } else {
          replacement = url;
        }

        link.replaceWith(document.createTextNode(replacement));
      });

      let text = clone.textContent
        .replace(/\s+/g, " ")
        .replace(/\s+([.,!?])/g, "$1")
        .trim();

      if (mediaPlaceholders.length > 0) {
        text += `\n[${mediaPlaceholders.join(", ")}]`;
      }

      return text;
    } catch (e) {
      logger.warn(`Error cleaning message text: ${e}`);
      return null;
    }
  }

  async function processMessagesToTXT(messageElements) {
    let allText = "";

    if (config.includeExportDate) {
      allText += `=== Telegram Chat Export ===\n`;
      allText += `Export Date: ${new Date().toLocaleString()}\n\n`;
    }

    for (let i = 0; i < messageElements.length; i += config.chunkSize) {
      const chunk = Array.from(messageElements).slice(i, i + config.chunkSize);
      for (const [index, messageEl] of chunk.entries()) {
        const metadata = extractMetadata(messageEl);
        const messageText = cleanMessageText(messageEl);

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
      await randomDelay();
    }

    if (config.includeMessageCount) {
      allText += `\n=== Export Summary ===\n`;
      allText += `Total Messages: ${messageElements.length}\n`;
      allText += `Export Completed: ${new Date().toLocaleString()}\n`;
    }

    return allText;
  }

  async function processMessagesToHTML(messageElements, chatName = "") {
    const messages = [];
    let participantCount = 0;
    const participants = new Set();

    for (let i = 0; i < messageElements.length; i += config.chunkSize) {
      const chunk = Array.from(messageElements).slice(i, i + config.chunkSize);
      for (const messageEl of chunk) {
        const metadata = extractMetadata(messageEl);
        const messageText = cleanMessageText(messageEl);

        if (messageText) {
          if (metadata.sender) participants.add(metadata.sender);
          messages.push({
            metadata,
            content: messageText,
            position: messages.length + 1,
          });
        }
      }
      await randomDelay();
    }

    participantCount = participants.size;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telegram Export: ${escapeHtml(chatName || "Chat")}</title>
    <style>
        :root {
            --primary-color: ${config.darkMode ? "#3498db" : "#2980b9"};
            --bg-color: ${config.darkMode ? "#1e2a3a" : "#f5f7fa"};
            --text-color: ${config.darkMode ? "#ecf0f1" : "#2c3e50"};
            --message-bg: ${config.darkMode ? "#2c3e50" : "#ffffff"};
            --message-border: ${config.darkMode ? "#34495e" : "#e0e6ed"};
            --meta-color: ${config.darkMode ? "#bdc3c7" : "#7f8c8d"};
            --forwarded-color: ${config.darkMode ? "#16a085" : "#1abc9c"};
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            background-color: var(--bg-color);
            color: var(--text-color);
            padding: 20px;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--primary-color);
        }

        .chat-title {
            font-size: 24px;
            margin-bottom: 10px;
            color: var(--primary-color);
        }

        .export-info {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            color: var(--meta-color);
            margin-bottom: 5px;
        }

        .stats {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        .stat-box {
            background-color: var(--message-bg);
            border-radius: 8px;
            padding: 10px 15px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            min-width: 120px;
            text-align: center;
        }

        .stat-value {
            font-size: 18px;
            font-weight: bold;
            color: var(--primary-color);
        }

        .stat-label {
            font-size: 12px;
            color: var(--meta-color);
            margin-top: 3px;
        }

        .messages-container {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .message {
            background-color: var(--message-bg);
            border-radius: 12px;
            padding: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-left: 4px solid var(--primary-color);
            position: relative;
            transition: transform 0.2s;
        }

        .message:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--message-border);
        }

        .sender-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .sender-name {
            font-weight: 600;
        }

        .message-meta {
            display: flex;
            gap: 10px;
            font-size: 13px;
            color: var(--meta-color);
        }

        .message-date {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .message-media {
            margin: 10px 0;
            border-radius: 8px;
            overflow: hidden;
            background: ${config.darkMode ? "#34495e" : "#f0f2f5"};
        }

        .media-thumbnail {
            display: block;
            max-width: ${config.maxMediaWidth};
            max-height: 300px;
            border-radius: 8px;
            object-fit: contain;
            margin: 0 auto;
        }

        .media-placeholder {
            padding: 15px;
            text-align: center;
            color: ${config.darkMode ? "#bdc3c7" : "#7f8c8d"};
            font-size: 14px;
            border: 1px dashed ${config.darkMode ? "#4a5a6b" : "#d0d5db"};
            border-radius: 8px;
        }

        .message-content {
            margin-top: 10px;
            white-space: pre-wrap;
            line-height: 1.5;
        }

        .forwarded-from {
            font-size: 13px;
            color: var(--forwarded-color);
            margin-top: 5px;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .message-number {
            position: absolute;
            top: -10px;
            left: -10px;
            background-color: var(--primary-color);
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
        }

        a {
            color: var(--primary-color);
            text-decoration: none;
        }

        a:hover {
            text-decoration: underline;
        }

        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid var(--primary-color);
            color: var(--meta-color);
            font-size: 14px;
        }

        @media (max-width: 600px) {
            .message-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 5px;
            }

            .message-meta {
                width: 100%;
                justify-content: space-between;
            }

            .media-thumbnail {
                max-width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1 class="chat-title">${escapeHtml(
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

        <main class="messages-container">`;

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
                              }"
                             class="media-thumbnail">`
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
                            ? `<video controls class="media-thumbnail">
                                <source src="${msg.metadata.mediaSrc}" type="video/mp4">
                                ${config.videoPlaceholder}
                            </video>`
                            : `<div class="media-placeholder">${config.videoPlaceholder}</div>`
                        }
                    </div>`;
          } else if (msg.metadata.hasGif) {
            mediaHTML = `
                    <div class="message-media">
                        ${
                          config.mediaAsThumbnails && msg.metadata.mediaSrc
                            ? `<img src="${msg.metadata.mediaSrc}" alt="GIF"
                             class="media-thumbnail">`
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
                        <span class="sender-name">${escapeHtml(
                          msg.metadata.sender || "Unknown"
                        )}</span>
                    </div>
                    <div class="message-meta">
                        <span class="message-date">
                            <span>${escapeHtml(
                              msg.metadata.date || "Unknown date"
                            )}</span>
                            <span>•</span>
                            <span>${escapeHtml(
                              msg.metadata.time || "Unknown time"
                            )}</span>
                        </span>
                    </div>
                </div>
                ${
                  msg.metadata.forwardedFrom
                    ? `
                <div class="forwarded-from">
                    <span>↩️ Forwarded from ${escapeHtml(
                      msg.metadata.forwardedFrom
                    )}</span>
                </div>
                `
                    : ""
                }
                ${mediaHTML}
                <div class="message-content">${escapeHtml(msg.content)}</div>
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
  }

  async function processMessagesToJSON(messageElements) {
    const messages = [];
    const participants = new Set();

    for (let i = 0; i < messageElements.length; i += config.chunkSize) {
      const chunk = Array.from(messageElements).slice(i, i + config.chunkSize);
      for (const messageEl of chunk) {
        const metadata = extractMetadata(messageEl);
        const messageText = cleanMessageText(messageEl);

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
      await randomDelay();
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
  }

  function escapeHtml(text) {
    if (!text) return "";
    return text
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cleanFileName(name) {
    return name.replace(/[^\w\s-]/gi, "").replace(/\s+/g, "_");
  }

  function getChatName() {
    try {
      const chatNameEl = document.querySelector(selectors.chatName);
      return chatNameEl ? chatNameEl.textContent.trim() : null;
    } catch (e) {
      return null;
    }
  }

  async function autoScrollToLoadMessages() {
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
        messageList.scrollTop = messageList.scrollHeight;

        scrollAttempts++;
        if (
          scrollAttempts >= config.maxScrollAttempts ||
          prevScrollHeight === messageList.scrollHeight
        ) {
          clearInterval(scrollInterval);
          resolve();
        }
      }, config.autoScrollInterval);
    });
  }

  function randomDelay() {
    const delay =
      config.delayBetweenChunks + Math.random() * config.maxRandomDelay;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  window.exportMessages = exportMessages;
})();
