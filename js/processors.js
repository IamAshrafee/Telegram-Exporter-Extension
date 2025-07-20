window.TelegramExporter.processors = {
  processMessagesToTXT: async function (messages) {
    const { utils } = window.TelegramExporter;
    let allText = "";

    allText += `=== Telegram Chat Export ===\n`;
    allText += `Export Date: ${new Date().toLocaleString()}\n\n`;

    for (const [index, message] of messages.entries()) {
      allText += `--- Message ${index + 1} ---\n`;
      if (message.date) allText += `Date: ${message.date}\n`;
      if (message.time) allText += `Time: ${message.time}\n`;
      if (message.sender) allText += `From: ${message.sender}\n`;
      if (message.isForwarded)
        allText += `Forwarded from: ${message.forwardedFrom || "Unknown"}\n`;
      if (message.isReply && message.replyInfo) {
        allText += `Replying to ${message.replyInfo.sender}: \"${message.replyInfo.text}\"\n`;
      }
      if (message.reactions && message.reactions.length > 0) {
        allText += `Reactions: ${message.reactions
          .map((r) => `${r.name} (${r.count})`)
          .join(", ")}\n`;
      }

      if (message.text) {
        allText += `\n${message.text}\n\n`;
      } else {
        allText += `\n`;
      }
    }

    allText += `\n=== Export Summary ===\n`;
    allText += `Total Messages: ${messages.length}\n`;

    return allText;
  },

  processMessagesToHTML: async function (messages, chatName = "") {
    const { utils, selectors } = window.TelegramExporter;
    const participants = new Set(messages.map((msg) => msg.sender));

    let messagesHTML = "";
    for (const msg of messages) {
      let contentHTML = msg.html;

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = contentHTML;
      tempDiv.querySelectorAll(selectors.emoji.standard).forEach((emojiEl) => {
        if (emojiEl.src.includes("img-apple-64")) {
          emojiEl.src = `https://web.telegram.org/a/${emojiEl.src.substring(
            emojiEl.src.indexOf("img-apple-64")
          )}`;
        }
      });
      contentHTML = tempDiv.innerHTML;

      let mediaHTML = "";
      if (msg.type === "media" && msg.media) {
        if (msg.media.type === "image") {
          mediaHTML = `<div class=\"mt-3\"><img src=\"${msg.media.src}\" alt=\"Image\" class=\"rounded-lg max-w-full h-auto\"></div>`;
        } else if (msg.media.type === "video") {
          mediaHTML = `<div class=\"mt-3\"><video controls src=\"${msg.media.src}\" class=\"rounded-lg max-w-full h-auto\"></video><div class=\"text-xs text-gray-500 mt-1\">Duration: ${msg.media.duration}</div></div>`;
        }
      } else if (msg.type === "poll" && msg.poll) {
        mediaHTML = `<div class=\"mt-3 border-l-4 border-gray-700 pl-4 py-3 bg-gray-800/50 rounded-r-lg transition hover:bg-gray-800\">
          <div class=\"font-semibold text-gray-200\">${utils.escapeHtml(
            msg.poll.question
          )}</div>
          <div class=\"mt-2 space-y-1\">
            ${msg.poll.options
              .map(
                (opt) => `
              <div class=\"flex justify-between items-center text-sm\">
                <span class=\"text-gray-400\">${utils.escapeHtml(
                  opt.text
                )}</span>
                <span class=\"text-gray-500 font-medium\">${utils.escapeHtml(
                  opt.percent || ""
                )}<\/span>
              <\/div>`
              )
              .join("")}
          <\/div>
        <\/div>`;
      } else if (msg.type === "file" && msg.file) {
        mediaHTML = `<div class=\"mt-3 bg-gray-800/50 border border-gray-700/80 rounded-lg p-3 flex items-center space-x-4 transition hover:bg-gray-800\">
          <div class=\"text-gray-500\"><svg class=\"w-8 h-8\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z\"></path><\/svg><\/div>
          <div>
            <div class=\"font-semibold text-gray-200\">${utils.escapeHtml(
              msg.file.title
            )}</div>
            <div class=\"text-sm text-gray-500\">${utils.escapeHtml(
              msg.file.subtitle
            )}</div>
          </div>
        </div>`;
      }

      const reactionsHTML =
        msg.reactions && msg.reactions.length > 0
          ? `<div class=\"mt-3 text-xs text-gray-500 pt-3 border-t border-gray-700/50 flex flex-wrap gap-2\">
            ${msg.reactions
              .map(
                (r) =>
                  `<span class=\"bg-gray-700/50 rounded-full px-3 py-1 text-gray-400\">${utils.escapeHtml(
                    r.name
                  )} ${utils.escapeHtml(r.count)}<\/span>`
              )
              .join("")}
           <\/div>`
          : "";

      const replyHTML =
        msg.isReply && msg.replyInfo
          ? `<div class=\"mb-3 border-l-4 border-gray-600 pl-3 text-sm\">
             <div class=\"font-semibold text-gray-400\">Reply to ${utils.escapeHtml(
               msg.replyInfo.sender
             )}<\/div>
             <div class=\"text-gray-500 truncate\">${utils.escapeHtml(
               msg.replyInfo.text
             )}<\/div>
           <\/div>`
          : "";

      const forwardedHTML = msg.isForwarded
        ? `<div class=\"text-xs text-gray-500 mb-2\">${utils.escapeHtml(
            msg.forwardedFrom
          )}<\/div>`
        : "";

      messagesHTML += `
        <div class=\"bg-gray-800/80 rounded-xl p-5 mb-4 shadow-lg border border-gray-700/50 transition-all duration-300 hover:shadow-2xl hover:border-gray-700\">
          <div class=\"flex justify-between items-center mb-3\">
            <div class=\"flex items-center space-x-3\">
              <span class=\"font-bold text-cyan-400\">${utils.escapeHtml(
                msg.sender
              )}<\/span>
            <\/div>
            <span class=\"text-xs text-gray-600 font-mono\">${utils.escapeHtml(
              msg.date
            )} at ${utils.escapeHtml(msg.time)}<\/span>
          <\/div>
          ${forwardedHTML}
          ${replyHTML}
          <div class=\"prose prose-sm prose-invert max-w-none\">${contentHTML}<\/div>
          ${mediaHTML}
          ${reactionsHTML}
        <\/div>`;
    }

    const html = `
      <!DOCTYPE html>
      <html lang=\"en\" class=\"dark\">
      <head>
          <meta charset=\"UTF-8\">
          <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
          <title>Telegram Export: ${utils.escapeHtml(
            chatName || "Chat"
          )}<\/title>
          <script src=\"https://cdn.tailwindcss.com\"><\/script>
          <script>
            tailwind.config = {
              darkMode: 'class',
              theme: {
                extend: {
                  typography: (theme) => ({
                    invert: {
                      css: {
                        '--tw-prose-body': theme('colors.gray[400]'),
                        '--tw-prose-headings': theme('colors.gray.200'),
                        '--tw-prose-links': theme('colors.cyan[400]'),
                        '--tw-prose-bold': theme('colors.gray.200'),
                        '--tw-prose-hr': theme('colors.gray.700/50'),
                        '--tw-prose-quotes': theme('colors.gray.200'),
                        '--tw-prose-quote-borders': theme('colors.gray.700'),
                        '--tw-prose-code': theme('colors.gray.200'),
                        '--tw-prose-pre-bg': theme('colors.gray.800/50'),
                      },
                    },
                  }),
                },
              },
            }
          <\/script>
          <style>
            body { background-color: #111827; font-family: 'Inter', sans-serif; }
            @import url('https://rsms.me/inter/inter.css');
            .prose-invert a { text-decoration: none; font-weight: 500; transition: color 0.2s ease-in-out; }
            .prose-invert a:hover { color: theme('colors.cyan.300'); }
            .emoji-small { width: 20px; height: 20px; display: inline-block; vertical-align: middle; }
          <\/style>
      <\/head>
      <body class=\"bg-gray-900 text-gray-400\">
          <div class=\"container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl\">
              <header class=\"text-center mb-12\">
                  <h1 class=\"text-4xl font-bold text-gray-200\">${utils.escapeHtml(
                    chatName || "Chat"
                  )}<\/h1>
                  <div class=\"text-sm text-gray-500 mt-4 space-x-5\">
                      <span>Exported on: <span class=\"font-medium text-gray-400\">${new Date().toLocaleString()}<\/span><\/span>
                      <span><span class=\"font-medium text-gray-400\">${
                        messages.length
                      }<\/span> Messages<\/span>
                      <span><span class=\"font-medium text-gray-400\">${
                        participants.size
                      }<\/span> Participants<\/span>
                  <\/div>
              <\/header>
              <main>${messagesHTML}<\/main>
          <\/div>
      <\/body>
      <\/html>`;

    return html;
  },

  processMessagesToJSON: async function (messages) {
    const participants = new Set(messages.map((msg) => msg.sender));

    const serializableMessages = messages.map((msg) => {
      const { element, ...rest } = msg;
      return rest;
    });

    return {
      meta: {
        exportDate: new Date().toISOString(),
        messageCount: messages.length,
        participantCount: participants.size,
        chatName: window.TelegramExporter.utils.getChatName(),
      },
      messages: serializableMessages,
    };
  },
};
