'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const exportTxt = document.getElementById('export-txt');
  const exportHtml = document.getElementById('export-html');
  const exportJson = document.getElementById('export-json');
  const darkMode = document.getElementById('dark-mode');

  exportTxt.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: () => window.exportMessages('txt'),
      });
    });
  });

  exportHtml.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: () => window.exportMessages('html'),
      });
    });
  });

  exportJson.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: () => window.exportMessages('json'),
      });
    });
  });

  darkMode.addEventListener('change', () => {
    chrome.storage.sync.set({ darkMode: darkMode.checked });
  });

  chrome.storage.sync.get('darkMode', (data) => {
    darkMode.checked = data.darkMode;
  });
});
