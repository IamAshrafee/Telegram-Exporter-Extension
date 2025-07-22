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

  function extractSingleMessage(el, currentDate) {
    if (el.matches(".SponsoredMessage")) return null;

    const messageId = el.getAttribute("data-message-id");
    if (seenMessageIds.has(messageId)) return null;
    seenMessageIds.add(messageId);

    const reactions = Array.from(
      el.querySelectorAll(selectors.reactionButton)
    ).map((btn) => {
      const name =
        btn.querySelector(selectors.reactionStaticEmoji)?.alt || "emoji";
      const count =
        btn.querySelector(selectors.reactionCount)?.innerText.trim() || "1";
      return { name, count };
    });

    const replyEl = el.querySelector(selectors.reply.container);
    let replyInfo = null;
    if (replyEl) {
      const replyText = replyEl
        .querySelector(selectors.reply.text)
        ?.innerText.trim();
      const replySender = replyEl
        .querySelector(selectors.reply.sender)
        ?.innerText.trim();
      replyInfo = {
        text: replyText,
        sender: replySender,
      };
    }

    const forwardEl = el.querySelector(selectors.forwarded.container);
    let forwardedInfo = null;
    if (forwardEl) {
      const title = forwardEl
        .querySelector(selectors.forwarded.title)
        ?.innerText.trim();
      const from = forwardEl
        .querySelector(selectors.forwarded.from)
        ?.innerText.trim();
      if (title && from) {
        forwardedInfo = `${title} ${from}`;
      }
    }

    const message = {
      id: messageId,
      element: el,
      type: "text",
      text: "",
      html: "",
      sender:
        el.querySelector(selectors.sender)?.textContent.trim() || "Unknown",
      time: el.querySelector(selectors.time)?.textContent.trim() || "Unknown",
      date: currentDate,
      isForwarded: !!forwardEl,
      forwardedFrom: forwardedInfo,
      isReply: !!replyEl,
      replyInfo: replyInfo,
      reactions: reactions,
      media: null,
      poll: null,
      file: null,
    };

    const contentEl = el.querySelector(selectors.contentSelector);
    if (contentEl) {
      const clone = contentEl.cloneNode(true);
      const meta = clone.querySelector(".MessageMeta");
      if (meta) meta.remove();

      const reactionsEl = clone.querySelector(selectors.reactions);
      if (reactionsEl) reactionsEl.remove();

      message.text = clone.innerText;
      message.html = clone.innerHTML;
    }

    const mediaImageEl = el.querySelector(selectors.media.image);
    if (mediaImageEl) {
      message.type = "media";
      message.media = { type: "image", src: mediaImageEl.src };
    }

    const mediaVideoEl = el.querySelector(selectors.media.video);
    if (mediaVideoEl) {
      message.type = "media";
      message.media = {
        type: "video",
        src: mediaVideoEl.src,
        duration: el
          .querySelector(selectors.media.videoDuration)
          ?.innerText.trim(),
      };
    }

    const pollEl = el.querySelector(selectors.poll.container);
    if (pollEl) {
      message.type = "poll";
      const question = pollEl
        .querySelector(selectors.poll.question)
        ?.innerText.trim();
      const pollType = pollEl
        .querySelector(selectors.poll.type)
        ?.innerText.trim();
      const options = Array.from(
        pollEl.querySelectorAll(selectors.poll.option)
      ).map((opt) => ({
        text: opt.querySelector(selectors.poll.optionText)?.innerText.trim(),
        percent: opt
          .querySelector(selectors.poll.optionPercent)
          ?.innerText.trim(),
        isChosen: !!opt.querySelector(selectors.poll.optionChosen),
      }));
      message.poll = { question, type: pollType, options };
    }

    const fileEl = el.querySelector(selectors.media.document);
    if (fileEl) {
      message.type = "file";
      const title = fileEl
        .querySelector(selectors.media.documentTitle)
        ?.innerText.trim();
      const subtitle = fileEl
        .querySelector(selectors.media.documentSubtitle)
        ?.innerText.trim();
      message.file = { title, subtitle };
    }

    const webPagePreview = el.querySelector(selectors.webPagePreview);
    if (webPagePreview) {
      webPagePreview.remove();
    }
    return message;
  }

  async function scrapeMessagesBackward() {
    const scrollContainer =
      document.querySelector(".messages-layout .scroller") ||
      document.querySelector(selectors.messageList);

    if (!scrollContainer) {
      logger.error("Scroll container not found!");
      return [];
    }

    // Step 1: Initialization
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

    // Step 2: Sequential Scraping Loop
    while (currentMessageId > 0) {
      let messageEl = document.querySelector(
        `[data-message-id="${currentMessageId}"]`
      );

      // If message is not in DOM, scroll up to load it
      if (!messageEl) {
        logger.info(`Message ${currentMessageId} not loaded. Scrolling up.`);
        const oldestMessage = document.querySelector("[data-message-id]");
        if (oldestMessage) {
          // Scroll the oldest visible message to the top to trigger loading
          oldestMessage.scrollIntoView({ block: "start" });
          await new Promise((resolve) =>
            setTimeout(resolve, config.scrollDelay)
          );
          // Retry finding the element
          messageEl = document.querySelector(
            `[data-message-id="${currentMessageId}"]`
          );
        }
      }

      // If still not found, skip it.
      if (!messageEl) {
        logger.warn(
          `Message with ID ${currentMessageId} not found after scrolling. Skipping.`
        );
        currentMessageId--;
        continue;
      }

      // Scroll the current message into view for the user
      messageEl.scrollIntoView({ block: "center", behavior: "smooth" });
      // Wait for the smooth scroll to finish before scraping
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Handle date groups
      const dateGroup = messageEl.closest(".message-date-group");
      if (dateGroup) {
        const dateEl = dateGroup.querySelector(selectors.dateGroupSelector);
        if (dateEl) {
          currentDate = dateEl.textContent.trim();
        }
      }

      // Step 3: Scrape the Message
      const message = extractSingleMessage(messageEl, currentDate);
      if (message) {
        allMessages.push(message);
      }

      // Step 4: Update Progress
      const progress =
        ((totalMessages - currentMessageId + 1) / totalMessages) * 100;
      dom.showLoading(
        true,
        `Scraped ${
          allMessages.length
        } / ${totalMessages} messages... (${progress.toFixed(0)}%)`
      );

      // Step 5: Wait and Decrement
      await new Promise((resolve) =>
        setTimeout(resolve, config.delayBetweenMessages)
      );
      currentMessageId--;
    }

    logger.success("Scraping complete.");
    // Step 3 (Finalization): Sorting
    return allMessages.reverse();
  }

  async function exportMessages(format = "txt") {
    window.TelegramExporter.currentExportFormat = format;
    try {
      dom.showLoading(true, `Preparing ${format.toUpperCase()} export...`);
      const chatName = utils.getChatName();
      const fileName = `telegram_${format}_${utils.cleanFileName(
        chatName || "chat"
      )}_${new Date().toISOString().slice(0, 10)}`;

      const messages = await scrapeMessagesBackward();

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
    }
  });
})();