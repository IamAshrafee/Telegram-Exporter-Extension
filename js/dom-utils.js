// This file contains utility functions for interacting with the DOM.

window.TelegramExporter = window.TelegramExporter || {};

window.TelegramExporter.dom = {
  /**
   * Shows or hides a loading indicator.
   * @param {boolean} show - Whether to show or hide the loader.
   * @param {string} text - The text to display in the loader.
   */
  showLoading: function (show, text = "") {
    let wrapper = document.getElementById("telegram-export-controls-wrapper");
    if (show) {
      if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.id = "telegram-export-controls-wrapper";
        wrapper.innerHTML = `
            <div class="action-buttons">
                <button id="pause-export-btn" class="action-button pause-button">Pause</button>
                <button id="finish-export-btn" class="action-button finish-button">Finish</button>
                <button id="cancel-export-btn" class="action-button cancel-button">Cancel</button>
            </div>
            <div id="telegram-export-loader">
                <div class="status-container">
                    <div class="spinner"></div>
                    <div class="loader-text"></div>
                </div>
            </div>
        `;
        document.body.appendChild(wrapper);

        const pauseBtn = wrapper.querySelector("#pause-export-btn");
        pauseBtn.addEventListener("click", () => {
            const isPaused = pauseBtn.textContent === "Resume";
            pauseBtn.textContent = isPaused ? "Pause" : "Resume";
            window.TelegramExporter.isPaused = !isPaused;
        });

        wrapper
          .querySelector("#finish-export-btn")
          .addEventListener("click", () => {
            window.TelegramExporter.isFinished = true;
          });

        wrapper
          .querySelector("#cancel-export-btn")
          .addEventListener("click", () => {
            window.TelegramExporter.isCancelled = true;
            this.showLoading(false);
            this.showAlert("Export cancelled by user.", "warning");
          });
      }
      if (text) {
        wrapper.querySelector(".loader-text").textContent = text;
      }
      wrapper.style.display = "flex";
    } else if (wrapper) {
      wrapper.style.display = "none";
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
