// This script handles the logic for the extension's popup.

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // Get references to the UI elements.
  const exportTxt = document.getElementById("export-txt");
  const exportHtml = document.getElementById("export-html");
  const exportJson = document.getElementById("export-json");

  // Add event listeners to the export buttons.
  exportTxt.addEventListener("click", () => {
    // When a button is clicked, execute the exportMessages function in the active tab.
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: () => window.exportMessages("txt"),
      });
    });
  });

  exportHtml.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: () => window.exportMessages("html"),
      });
    });
  });

  exportJson.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: () => window.exportMessages("json"),
      });
    });
  });

});
