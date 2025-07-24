"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const exportTxt = document.getElementById("export-txt");
  const exportHtml = document.getElementById("export-html");
  const exportJson = document.getElementById("export-json");
  const errorMessage = document.getElementById("error-message");

  function sendMessageToContentScript(format) {
    errorMessage.style.display = "none"; // Hide error on new action
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        errorMessage.textContent = "No active tab found.";
        errorMessage.style.display = "block";
        return;
      }
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          action: "export",
          format: format,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            errorMessage.textContent =
              "Could not connect to the page. Please refresh the Telegram tab and try again.";
            errorMessage.style.display = "block";
            console.error(chrome.runtime.lastError.message);
          } else {
            // Handle successful response if needed
            if (response) {
              console.log(response.status);
            }
            window.close(); // Close popup on success
          }
        }
      );
    });
  }

  exportTxt.addEventListener("click", () => sendMessageToContentScript("txt"));
  exportHtml.addEventListener("click", () =>
    sendMessageToContentScript("html")
  );
  exportJson.addEventListener("click", () =>
    sendMessageToContentScript("json")
  );
});