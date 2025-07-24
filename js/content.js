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

  // Enhanced tracking and state management
  const seenMessageIds = new Set();
  let exportStats = {
    totalMessages: 0,
    processedMessages: 0,
    skippedMessages: 0,
    errorCount: 0,
    startTime: null,
    lastProgressUpdate: 0
  };

  // Network performance tracking
  let networkPerformance = {
    averageLoadTime: 1000,
    consecutiveErrors: 0,
    adaptiveDelay: config.delayBetweenMessages
  };

  // Enhanced scroll container detection
  function findScrollContainer() {
    for (const selector of selectors.scrollContainer) {
      const container = document.querySelector(selector);
      if (container) {
        logger.info(`Found scroll container: ${selector}`);
        return container;
      }
    }
    
    // Fallback: find any scrollable container with messages
    const containers = document.querySelectorAll('[class*="message"], [class*="scroll"]');
    for (const container of containers) {
      if (container.scrollHeight > container.clientHeight) {
        logger.warn(`Using fallback scroll container: ${container.className}`);
        return container;
      }
    }
    
    return null;
  }

  // Intelligent message loading with retry mechanism
  async function loadMessageWithRetry(messageId, maxRetries = config.maxRetryAttempts) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      
      let messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
      
      if (messageEl) {
        // Update network performance metrics
        const loadTime = Date.now() - startTime;
        networkPerformance.averageLoadTime = 
          (networkPerformance.averageLoadTime * 0.8) + (loadTime * 0.2);
        networkPerformance.consecutiveErrors = 0;
        return messageEl;
      }

      // Intelligent scrolling strategy
      if (attempt <= maxRetries) {
        logger.info(`Attempt ${attempt}/${maxRetries}: Loading message ${messageId}`);
        
        const success = await intelligentScroll(messageId);
        if (!success && attempt === maxRetries) {
          networkPerformance.consecutiveErrors++;
          break;
        }
        
        // Adaptive delay based on network performance
        const delay = Math.min(
          config.scrollDelay + (attempt * 200),
          networkPerformance.averageLoadTime * 1.5
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        
        messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
          networkPerformance.consecutiveErrors = 0;
          return messageEl;
        }
      }
    }
    
    logger.warn(`Failed to load message ${messageId} after ${maxRetries} attempts`);
    return null;
  }

  // Enhanced intelligent scrolling
  async function intelligentScroll(targetMessageId) {
    const scrollContainer = findScrollContainer();
    if (!scrollContainer) {
      logger.error("No scroll container found for intelligent scrolling");
      return false;
    }

    // Get current message range
    const currentMessages = [...document.querySelectorAll("[data-message-id]")];
    if (currentMessages.length === 0) return false;

    const currentIds = currentMessages.map(el => parseInt(el.getAttribute("data-message-id"), 10));
    const minId = Math.min(...currentIds);
    const maxId = Math.max(...currentIds);

    // Determine scroll direction and strategy
    if (targetMessageId < minId) {
      // Need to scroll up (backward in time)
      return await scrollToLoadOlderMessages(scrollContainer, targetMessageId, minId);
    } else if (targetMessageId > maxId) {
      // Need to scroll down (forward in time)
      return await scrollToLoadNewerMessages(scrollContainer, targetMessageId, maxId);
    }
    
    return true; // Message should be in current viewport
  }

  // Optimized backward scrolling for older messages
  async function scrollToLoadOlderMessages(container, targetId, currentMinId) {
    const messagesToLoad = currentMinId - targetId;
    const estimatedScrolls = Math.ceil(messagesToLoad / 20); // Estimate 20 messages per scroll
    
    logger.info(`Scrolling up to load ~${messagesToLoad} older messages (${estimatedScrolls} scrolls estimated)`);
    
    for (let i = 0; i < Math.min(estimatedScrolls * 2, config.maxScrollAttempts); i++) {
      if (window.TelegramExporter.isCancelled) return false;
      
      // Find the oldest visible message
      const oldestMessage = document.querySelector("[data-message-id]");
      if (!oldestMessage) break;
      
      const oldestId = parseInt(oldestMessage.getAttribute("data-message-id"), 10);
      
      // Check if we've loaded enough
      if (oldestId <= targetId) {
        logger.info(`Successfully scrolled to target range. Oldest visible: ${oldestId}`);
        return true;
      }
      
      // Perform scroll
      oldestMessage.scrollIntoView({ 
        block: "start", 
        behavior: "smooth" 
      });
      
      // Adaptive delay based on performance
      const delay = Math.max(
        config.scrollDelay,
        networkPerformance.averageLoadTime * 0.8
      );
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Check for new messages loaded
      const newOldestMessage = document.querySelector("[data-message-id]");
      const newOldestId = newOldestMessage ? 
        parseInt(newOldestMessage.getAttribute("data-message-id"), 10) : oldestId;
      
      if (newOldestId >= oldestId) {
        // No new messages loaded, try different scroll strategy
        container.scrollBy(0, -config.scrollChunkSize);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return false;
  }

  // Optimized forward scrolling for newer messages
  async function scrollToLoadNewerMessages(container, targetId, currentMaxId) {
    const messagesToLoad = targetId - currentMaxId;
    const estimatedScrolls = Math.ceil(messagesToLoad / 20);
    
    logger.info(`Scrolling down to load ~${messagesToLoad} newer messages`);
    
    for (let i = 0; i < Math.min(estimatedScrolls * 2, config.maxScrollAttempts); i++) {
      if (window.TelegramExporter.isCancelled) return false;
      
      const newestMessage = [...document.querySelectorAll("[data-message-id]")].pop();
      if (!newestMessage) break;
      
      const newestId = parseInt(newestMessage.getAttribute("data-message-id"), 10);
      
      if (newestId >= targetId) {
        logger.info(`Successfully scrolled to target range. Newest visible: ${newestId}`);
        return true;
      }
      
      newestMessage.scrollIntoView({ 
        block: "end", 
        behavior: "smooth" 
      });
      
      const delay = Math.max(config.scrollDelay, networkPerformance.averageLoadTime * 0.8);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    return false;
  }

  // Memory optimization: cleanup processed messages
  function cleanupMemory() {
    if (!config.enableMemoryOptimization) return;
    
    const allMessages = document.querySelectorAll("[data-message-id]");
    if (allMessages.length <= config.maxMessagesInMemory) return;
    
    // Remove messages that are far from current viewport
    const viewportTop = window.scrollY;
    const viewportBottom = viewportTop + window.innerHeight;
    const bufferZone = window.innerHeight * config.viewportBuffer;
    
    let removedCount = 0;
    allMessages.forEach((msg, index) => {
      if (index % 3 !== 0) return; // Only check every 3rd message for performance
      
      const rect = msg.getBoundingClientRect();
      const msgTop = rect.top + window.scrollY;
      
      // Remove messages far outside viewport
      if (msgTop < viewportTop - bufferZone || msgTop > viewportBottom + bufferZone) {
        const messageId = msg.getAttribute("data-message-id");
        if (seenMessageIds.has(messageId)) {
          // Only remove if we've already processed it
          msg.remove();
          removedCount++;
        }
      }
    });
    
    if (removedCount > 0) {
      logger.info(`Cleaned up ${removedCount} processed messages from memory`);
    }
  }

  async function scrapeMessagesBackward() {
    const scrollContainer = findScrollContainer();
    if (!scrollContainer) {
      logger.error("Scroll container not found!");
      return [];
    }

    const messageElements = [...document.querySelectorAll("[data-message-id]")];
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

    // Initialize export stats
    exportStats = {
      totalMessages,
      processedMessages: 0,
      skippedMessages: 0,
      errorCount: 0,
      startTime: Date.now(),
      lastProgressUpdate: 0
    };

    let allMessages = [];
    let currentMessageId = totalMessages;
    let currentDate = "";
    let consecutiveErrors = 0;

    logger.info(`Starting enhanced scrape from message ID: ${totalMessages}`);

    while (currentMessageId > 0) {
      // Check cancellation/pause states
      if (window.TelegramExporter.isCancelled) {
        logger.warn("Scraping cancelled by user.");
        break;
      }

      if (window.TelegramExporter.isFinished) {
        logger.info("Scraping finished by user.");
        break;
      }

      if (window.TelegramExporter.isPaused) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      try {
        // Load message with intelligent retry
        const messageEl = await loadMessageWithRetry(currentMessageId);
        
        if (!messageEl) {
          logger.warn(`Message ${currentMessageId} not found after retries. Skipping.`);
          exportStats.skippedMessages++;
          consecutiveErrors++;
          
          // Error recovery mechanism
          if (consecutiveErrors >= config.maxConsecutiveErrors) {
            logger.error(`Too many consecutive errors (${consecutiveErrors}). Implementing recovery...`);
            await new Promise(resolve => setTimeout(resolve, config.errorRecoveryDelay));
            consecutiveErrors = 0;
          }
          
          currentMessageId--;
          continue;
        }

        consecutiveErrors = 0; // Reset error counter

        // Ensure message is visible
        messageEl.scrollIntoView({ block: "center", behavior: "smooth" });
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Extract date information
        const dateGroup = messageEl.closest(".message-date-group");
        if (dateGroup) {
          const dateEl = dateGroup.querySelector(selectors.dateGroupSelector);
          if (dateEl) {
            currentDate = dateEl.textContent.trim();
          }
        }

        // Extract message data
        const message = extractSingleMessage(messageEl, currentDate);
        if (message) {
          allMessages.push(message);
          exportStats.processedMessages++;
        }

        // Update progress
        if (exportStats.processedMessages % config.progressUpdateInterval === 0) {
          const progress = ((totalMessages - currentMessageId + 1) / totalMessages) * 100;
          const elapsed = Date.now() - exportStats.startTime;
          const rate = exportStats.processedMessages / (elapsed / 1000);
          const eta = (totalMessages - exportStats.processedMessages) / rate;
          
          dom.showLoading(
            true,
            `Scraped ${exportStats.processedMessages} / ${totalMessages} messages (${progress.toFixed(1)}%) | Rate: ${rate.toFixed(1)}/s | ETA: ${Math.round(eta)}s`
          );
        }

        // Memory cleanup
        if (exportStats.processedMessages % config.memoryCleanupInterval === 0) {
          cleanupMemory();
        }

        // Adaptive delay based on performance
        await new Promise((resolve) =>
          setTimeout(resolve, networkPerformance.adaptiveDelay)
        );

      } catch (error) {
        logger.error(`Error processing message ${currentMessageId}: ${error.message}`);
        exportStats.errorCount++;
        consecutiveErrors++;
      }

      currentMessageId--;
    }

    // Final statistics
    const totalTime = (Date.now() - exportStats.startTime) / 1000;
    logger.success(`Scraping complete! Processed: ${exportStats.processedMessages}, Skipped: ${exportStats.skippedMessages}, Errors: ${exportStats.errorCount}, Time: ${totalTime.toFixed(1)}s`);
    
    return allMessages.reverse();
  }

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

  // Enhanced scraping function with intelligent batching
  async function scrapeMessagesBackward() {
    const scrollContainer = findScrollContainer();
    if (!scrollContainer) {
      logger.error("Scroll container not found!");
      return [];
    }

    const messageElements = [...document.querySelectorAll("[data-message-id]")];
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

    // Initialize export stats
    exportStats = {
      totalMessages,
      processedMessages: 0,
      skippedMessages: 0,
      errorCount: 0,
      startTime: Date.now(),
      lastProgressUpdate: 0
    };

    let allMessages = [];
    let currentMessageId = totalMessages;
    let currentDate = "";
    let consecutiveErrors = 0;

    logger.info(`Starting enhanced scrape from message ID: ${totalMessages}`);

    while (currentMessageId > 0) {
      // Check cancellation/pause states
      if (window.TelegramExporter.isCancelled) {
        logger.warn("Scraping cancelled by user.");
        break;
      }

      if (window.TelegramExporter.isFinished) {
        logger.info("Scraping finished by user.");
        break;
      }

      if (window.TelegramExporter.isPaused) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      try {
        // Load message with intelligent retry
        const messageEl = await loadMessageWithRetry(currentMessageId);
        
        if (!messageEl) {
          logger.warn(`Message ${currentMessageId} not found after retries. Skipping.`);
          exportStats.skippedMessages++;
          consecutiveErrors++;
          
          // Error recovery mechanism
          if (consecutiveErrors >= config.maxConsecutiveErrors) {
            logger.error(`Too many consecutive errors (${consecutiveErrors}). Implementing recovery...`);
            await new Promise(resolve => setTimeout(resolve, config.errorRecoveryDelay));
            consecutiveErrors = 0;
          }
          
          currentMessageId--;
          continue;
        }

        consecutiveErrors = 0; // Reset error counter

        // Ensure message is visible
        messageEl.scrollIntoView({ block: "center", behavior: "smooth" });
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Extract date information
        const dateGroup = messageEl.closest(".message-date-group");
        if (dateGroup) {
          const dateEl = dateGroup.querySelector(selectors.dateGroupSelector);
          if (dateEl) {
            currentDate = dateEl.textContent.trim();
          }
        }

        // Extract message data
        const message = extractSingleMessage(messageEl, currentDate);
        if (message) {
          allMessages.push(message);
          exportStats.processedMessages++;
        }

        // Update progress
        if (exportStats.processedMessages % config.progressUpdateInterval === 0) {
          const progress = ((totalMessages - currentMessageId + 1) / totalMessages) * 100;
          const elapsed = Date.now() - exportStats.startTime;
          const rate = exportStats.processedMessages / (elapsed / 1000);
          const eta = (totalMessages - exportStats.processedMessages) / rate;
          
          dom.showLoading(
            true,
            `Scraped ${exportStats.processedMessages} / ${totalMessages} messages (${progress.toFixed(1)}%) | Rate: ${rate.toFixed(1)}/s | ETA: ${Math.round(eta)}s`
          );
        }

        // Memory cleanup
        if (exportStats.processedMessages % config.memoryCleanupInterval === 0) {
          cleanupMemory();
        }

        // Adaptive delay based on performance
        await new Promise((resolve) =>
          setTimeout(resolve, networkPerformance.adaptiveDelay)
        );

      } catch (error) {
        logger.error(`Error processing message ${currentMessageId}: ${error.message}`);
        exportStats.errorCount++;
        consecutiveErrors++;
      }

      currentMessageId--;
    }

    // Final statistics
    const totalTime = (Date.now() - exportStats.startTime) / 1000;
    logger.success(`Scraping complete! Processed: ${exportStats.processedMessages}, Skipped: ${exportStats.skippedMessages}, Errors: ${exportStats.errorCount}, Time: ${totalTime.toFixed(1)}s`);
    
    return allMessages.reverse();
  }

  async function exportMessages(format = "txt") {
    window.TelegramExporter.isCancelled = false; // Reset cancellation flag
    window.TelegramExporter.isPaused = false;
    window.TelegramExporter.isFinished = false;
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
