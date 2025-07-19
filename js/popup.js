"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const exportTxt = document.getElementById("export-txt");
  const exportHtml = document.getElementById("export-html");
  const exportJson = document.getElementById("export-json");

  function sendMessageToContentScript(format) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "export",
          format: format,
        });
      }
    });
  }

  exportTxt.addEventListener("click", () => sendMessageToContentScript("txt"));
  exportHtml.addEventListener("click", () => sendMessageToContentScript("html"));
  exportJson.addEventListener("click", () => sendMessageToContentScript("json"));
});