(function () {
  "use strict";

  const { config, selectors, dom, processors, utils } = window.TelegramExporter;

  const logger = {
    log: (message) => console.log(`[Telegram Exporter] ${message}`),
    info: (message) => console.info(`%c[Telegram Exporter] ${message}`, "color: #3498db"),
    success: (message) => console.log(`%c[Telegram Exporter] ${message}`, "color: #2ecc71"),
    error: (message) => console.error(`%c[Telegram Exporter] ${message}`, "color: #e74c3c"),
    warn: (message) => console.warn(`%c[Telegram Exporter] ${message}`, "color: #f39c12"),
  };

  function extractMessages() {
    const messageElements = document.querySelectorAll(selectors.messageSelector);
    const messages = [];
    let currentDate = "";

    messageElements.forEach((el, index) => {
      if (el.matches(".SponsoredMessage")) return;

      const dateGroup = el.closest(".message-date-group");
      if (dateGroup) {
        const dateEl = dateGroup.querySelector(selectors.dateGroupSelector);
        if (dateEl) {
          currentDate = dateEl.innerText.trim();
        }
      }

      const reactions = Array.from(el.querySelectorAll(selectors.reactionButton)).map(btn => {
        const name = btn.querySelector(selectors.reactionStaticEmoji)?.alt || 'emoji';
        const count = btn.querySelector(selectors.reactionCount)?.innerText.trim() || '1';
        return { name, count };
      });

      const replyEl = el.querySelector(selectors.reply.container);
      let replyInfo = null;
      if (replyEl) {
        const replyText = replyEl.querySelector(selectors.reply.text)?.innerText.trim();
        const replySender = replyEl.querySelector(selectors.reply.sender)?.innerText.trim();
        replyInfo = {
          text: replyText,
          sender: replySender,
        };
      }

      const forwardEl = el.querySelector(selectors.forwarded.container);
      let forwardedInfo = null;
      if (forwardEl) {
        const title = forwardEl.querySelector(selectors.forwarded.title)?.innerText.trim();
        const from = forwardEl.querySelector(selectors.forwarded.from)?.innerText.trim();
        if (title && from) {
          forwardedInfo = `${title} ${from}`;
        }
      }

      const message = {
        id: index,
        element: el,
        type: "text",
        text: "",
        html: "",
        sender: el.querySelector(selectors.sender)?.innerText.trim() || "Unknown",
        time: el.querySelector(selectors.time)?.innerText.trim() || "Unknown",
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
        const meta = clone.querySelector('.MessageMeta');
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
          duration: el.querySelector(selectors.media.videoDuration)?.innerText.trim(),
        };
      }

      const pollEl = el.querySelector(selectors.poll.container);
      if (pollEl) {
        message.type = "poll";
        const question = pollEl.querySelector(selectors.poll.question)?.innerText.trim();
        const pollType = pollEl.querySelector(selectors.poll.type)?.innerText.trim();
        const options = Array.from(pollEl.querySelectorAll(selectors.poll.option)).map(
          (opt) => ({
            text: opt.querySelector(selectors.poll.optionText)?.innerText.trim(),
            percent: opt.querySelector(selectors.poll.optionPercent)?.innerText.trim(),
            isChosen: !!opt.querySelector(selectors.poll.optionChosen),
          })
        );
        message.poll = { question, type: pollType, options };
      }

      const fileEl = el.querySelector(selectors.media.document);
      if (fileEl) {
        message.type = "file";
        const title = fileEl.querySelector(selectors.media.documentTitle)?.innerText.trim();
        const subtitle = fileEl.querySelector(selectors.media.documentSubtitle)?.innerText.trim();
        message.file = { title, subtitle };
      }

      const webPagePreview = el.querySelector(selectors.webPagePreview);
      if (webPagePreview) {
        webPagePreview.remove();
      }

      messages.push(message);
    });

    return messages;
  }

  async function exportMessages(format = "txt") {
    window.TelegramExporter.currentExportFormat = format;
    try {
      dom.showLoading(true, `Preparing ${format.toUpperCase()} export...`);
      const chatName = utils.getChatName();
      const fileName = `telegram_${format}_${utils.cleanFileName(
        chatName || "chat"
      )}_${new Date().toISOString().slice(0, 10)}`;

      await utils.autoScrollToLoadMessages();
      const messages = extractMessages();

      if (messages.length === 0) {
        dom.showAlert("No messages found!", "warning");
        return;
      }

      dom.showLoading(true, `Processing ${messages.length} messages...`);
      let exportedData;

      switch (format.toLowerCase()) {
        case "html":
          exportedData = await processors.processMessagesToHTML(messages, chatName);
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

      logger.success(`Exported ${messages.length} messages in ${format.toUpperCase()} format`);
      dom.showAlert(`Exported ${messages.length} messages!`, "success");
    } catch (error) {
      logger.error(`Export failed: ${error.stack}`);
      dom.showAlert("Export failed! Check console for details.", "error");
    } finally {
      dom.showLoading(false);
      delete window.TelegramExporter.currentExportFormat;
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "export") {
      exportMessages(request.format);
    }
  });
})();
