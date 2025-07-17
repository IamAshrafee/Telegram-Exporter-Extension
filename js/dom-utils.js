// This file contains utility functions for interacting with the DOM.

window.TelegramExporter.dom = {
  /**
   * Shows or hides a loading indicator.
   * @param {boolean} show - Whether to show or hide the loader.
   * @param {string} text - The text to display in the loader.
   */
  showLoading: function (show, text = "") {
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
    }
  },

  /**
   * Displays a temporary alert message.
   * @param {string} message - The message to display.
   * @param {string} type - The type of alert (info, success, warning, error).
   */
  showAlert: function (message, type = "info") {
    const alert = document.createElement("div");
    alert.className = `telegram-exporter-alert ${type}`;
    alert.textContent = message;
    document.body.appendChild(alert);

    // Remove the alert after a short delay.
    setTimeout(() => {
      alert.style.opacity = "0";
      setTimeout(() => alert.remove(), 300);
    }, 3000);
  },
};
