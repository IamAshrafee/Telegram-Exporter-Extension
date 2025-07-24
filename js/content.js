(function () {
  "use strict";

  const { config, selectors, dom, processors, utils } = window.TelegramExporter;

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

  // Track seen messages to prevent duplicates
  const seenMessageIds = new Set();

  function _extractReactions(el) {
    return Array.from(el.querySelectorAll(selectors.reactionButton)).map(
      (btn) => {
        const name =
          btn.querySelector(selectors.reactionStaticEmoji)?.alt || "emoji";
        const count =
          btn.querySelector(selectors.reactionCount)?.innerText.trim() || "1";
        return { name, count };
      }
    );
  }

  function _extractReplyInfo(el) {
    const replyEl = el.querySelector(selectors.reply.container);
    if (!replyEl) return null;

    const replyText = replyEl
      .querySelector(selectors.reply.text)
      ?.innerText.trim();
    const replySender = replyEl
      .querySelector(selectors.reply.sender)
      ?.innerText.trim();
    return {
      text: replyText,
      sender: replySender,
    };
  }

  function _extractForwardInfo(el) {
    const forwardEl = el.querySelector(selectors.forwarded.container);
    if (!forwardEl) return null;

    const title = forwardEl
      .querySelector(selectors.forwarded.title)
      ?.innerText.trim();
    const from = forwardEl
      .querySelector(selectors.forwarded.from)
      ?.innerText.trim();
    return title && from ? `${title} ${from}` : null;
  }

  function _extractMediaInfo(el) {
    const mediaImageEl = el.querySelector(selectors.media.image);
    if (mediaImageEl) {
      return { type: "image", src: mediaImageEl.src };
    }

    const mediaVideoEl = el.querySelector(selectors.media.video);
    if (mediaVideoEl) {
      return {
        type: "video",
        src: mediaVideoEl.src,
        duration: el
          .querySelector(selectors.media.videoDuration)
          ?.innerText.trim(),
      };
    }
    return null;
  }

  function _extractPollInfo(el) {
    const pollEl = el.querySelector(selectors.poll.container);
    if (!pollEl) return null;

    const question = pollEl
      .querySelector(selectors.poll.question)
      ?.innerText.trim();
    const pollType = pollEl.querySelector(selectors.poll.type)?.innerText.trim();
    const options = Array.from(
      pollEl.querySelectorAll(selectors.poll.option)
    ).map((opt) => ({
      text: opt.querySelector(selectors.poll.optionText)?.innerText.trim(),
      percent: opt.querySelector(selectors.poll.optionPercent)?.innerText.trim(),
      isChosen: !!opt.querySelector(selectors.poll.optionChosen),
    }));
    return { question, type: pollType, options };
  }

  function _extractFileInfo(el) {
    const fileEl = el.querySelector(selectors.media.document);
    if (!fileEl) return null;

    const title = fileEl
      .querySelector(selectors.media.documentTitle)
      ?.innerText.trim();
    const subtitle = fileEl
      .querySelector(selectors.media.documentSubtitle)
      ?.innerText.trim();
    return { title, subtitle };
  }

  function _extractTextAndHtml(el) {
    const contentEl = el.querySelector(selectors.contentSelector);
    if (!contentEl) return { text: "", html: "" };

    const clone = contentEl.cloneNode(true);
    // Clean up the cloned element
    const meta = clone.querySelector(".MessageMeta");
    if (meta) meta.remove();
    const reactionsEl = clone.querySelector(selectors.reactions);
    if (reactionsEl) reactionsEl.remove();
    const webPagePreview = clone.querySelector(selectors.webPagePreview);
    if (webPagePreview) webPagePreview.remove();


    return { text: clone.innerText, html: clone.innerHTML };
  }

  function extractSingleMessage(el, currentDate) {
    if (el.matches(".SponsoredMessage")) return null;

    const messageId = el.getAttribute("data-message-id");
    if (seenMessageIds.has(messageId)) return null;
    seenMessageIds.add(messageId);

    const replyInfo = _extractReplyInfo(el);
    const forwardedInfo = _extractForwardInfo(el);
    const media = _extractMediaInfo(el);
    const poll = _extractPollInfo(el);
    const file = _extractFileInfo(el);
    const { text, html } = _extractTextAndHtml(el);

    let type = "text";
    if (media) type = "media";
    else if (poll) type = "poll";
    else if (file) type = "file";

    return {
      id: messageId,
      element: el,
      type: type,
      text: text,
      html: html,
      sender:
        el.querySelector(selectors.sender)?.textContent.trim() || "Unknown",
      time: el.querySelector(selectors.time)?.textContent.trim() || "Unknown",
      date: currentDate,
      isForwarded: !!forwardedInfo,
      forwardedFrom: forwardedInfo,
      isReply: !!replyInfo,
      replyInfo: replyInfo,
      reactions: _extractReactions(el),
      media: media,
      poll: poll,
      file: file,
    };
  }

  async function scrapeMessagesBackward() {
    const scrollContainer =
      document.querySelector(".messages-layout .scroller") ||
      document.querySelector(selectors.messageList);

    if (!scrollContainer) {
      logger.error("Scroll container not found!");
      return [];
    }

    const messageElements = [
      ...document.querySelectorAll("[data-message-id]"),
    ];
    if (messageElements.length === 0) {
      logger.warn("No messages found on screen to start export.");
      dom.showAlert("No messages found!", "warning");
      return [];
    }
    const totalMessages = Math.max(
      ...messageElements.map((el) =>
        parseInt(el.getAttribute("data-message-id"), 10)
      )
    );

    let allMessages = [];
    let currentMessageId = totalMessages;
    let currentDate = "";

    logger.info(`Starting scrape from message ID: ${totalMessages}`);

    while (currentMessageId > 0) {
       if (window.TelegramExporter.isCancelled) {
          logger.warn("Scraping cancelled by user.");
          break; // Exit loop
       }

      let messageEl = document.querySelector(
        `[data-message-id="${currentMessageId}"]`
      );

      if (!messageEl) {
        logger.info(`Message ${currentMessageId} not loaded. Scrolling up.`);
        const oldestMessage = document.querySelector("[data-message-id]");
        if (oldestMessage) {
          oldestMessage.scrollIntoView({ block: "start" });
          await new Promise((resolve) =>
            setTimeout(resolve, config.scrollDelay)
          );
          messageEl = document.querySelector(
            `[data-message-id="${currentMessageId}"]`
          );
        }
      }

      if (!messageEl) {
        logger.warn(
          `Message with ID ${currentMessageId} not found after scrolling. Skipping.`
        );
        currentMessageId--;
        continue;
      }

      messageEl.scrollIntoView({ block: "center", behavior: "smooth" });
      await new Promise((resolve) => setTimeout(resolve, 400));

      const dateGroup = messageEl.closest(".message-date-group");
      if (dateGroup) {
        const dateEl = dateGroup.querySelector(selectors.dateGroupSelector);
        if (dateEl) {
          currentDate = dateEl.textContent.trim();
        }
      }

      const message = extractSingleMessage(messageEl, currentDate);
      if (message) {
        allMessages.push(message);
      }

      const progress =
        ((totalMessages - currentMessageId + 1) / totalMessages) * 100;
      dom.showLoading(
        true,
        `Scraped ${
          allMessages.length
        } / ${totalMessages} messages... (${progress.toFixed(0)}%)`
      );

      await new Promise((resolve) =>
        setTimeout(resolve, config.delayBetweenMessages)
      );
      currentMessageId--;
    }

    logger.success("Scraping complete.");
    return allMessages.reverse();
  }

  async function exportMessages(format = "txt") {
    window.TelegramExporter.isCancelled = false; // Reset cancellation flag
    window.TelegramExporter.currentExportFormat = format;
    try {
      dom.showLoading(true, `Preparing ${format.toUpperCase()} export...`);
      const chatName = utils.getChatName();
      const fileName = `telegram_${format}_${utils.cleanFileName(
        chatName || "chat"
      )}_${new Date().toISOString().slice(0, 10)}`;

      const messages = await scrapeMessagesBackward();

      if (window.TelegramExporter.isCancelled) {
        logger.warn("Export was cancelled. No file will be downloaded.");
        return;
      }

      if (messages.length === 0) {
        dom.showAlert("No messages found!", "warning");
        return;
      }

      dom.showLoading(true, `Processing ${messages.length} messages...`);
      let exportedData;

      switch (format.toLowerCase()) {
        case "html":
          exportedData = await processors.processMessagesToHTML(
            messages,
            chatName
          );
          utils.downloadFile(exportedData, `${fileName}.html`, "text/html");
          break;
        case "json":
          exportedData = await processors.processMessagesToJSON(messages);
          utils.downloadFile(
            JSON.stringify(exportedData, null, 2),
            `${fileName}.json`,
            "application/json"
          );
          break;
        default:
          exportedData = await processors.processMessagesToTXT(messages);
          utils.downloadFile(exportedData, `${fileName}.txt`, "text/plain");
      }

      logger.success(
        `Exported ${messages.length} messages in ${format.toUpperCase()} format`
      );
      dom.showAlert(`Exported ${messages.length} messages!`, "success");
    } catch (error) {
      logger.error(`Export failed: ${error.stack}`);
      dom.showAlert("Export failed! Check console for details.", "error");
    } finally {
      dom.showLoading(false);
      delete window.TelegramExporter.currentExportFormat;
      seenMessageIds.clear(); // Reset for next export
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "export") {
      exportMessages(request.format);
      // To satisfy the linter and chrome runtime which expects a response.
      sendResponse({status: "Export started"});
    }
    // Keep the message channel open for asynchronous response
    return true;
  });
})();
