// chatMain.js
(() => {
  "use strict";

  // Constants
  const API_ENDPOINT = "https://synthwave.app.n8n.cloud/webhook/16075ac1-3c90-4b68-a481-21bec8fdd1ae/chat";
  const HISTORY_KEY = "chatHistory";
  const HISTORY_EXPIRATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  const MAX_HISTORY_SIZE = 100;
  const POPUP_ID = "932"; // Elementor popup ID

  // Format links with target="_blank" for external URLs
  function formatLinks(html) {
    try {
      return html.replace(/<a\s+([^>]+)>/gi, (match, attrs) => {
        const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
        if (!hrefMatch) return match;
        const href = hrefMatch[1].toLowerCase();
        const isInternal = href.includes("synthwave.so") || /^(\/|\.\/|\.\.\/)/.test(href) || (!/^(mailto:|:\/\/)/.test(href));
        return isInternal ? match : /target\s*=\s*["']_blank["']/i.test(attrs) ? match : `<a ${attrs} target="_blank" rel="noopener">`;
      });
    } catch (error) {
      console.error("chatMain.js: Error formatting links:", error);
      return html;
    }
  }

  // Load history from localStorage
  function loadChatHistory() {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    try {
      const { timestamp, messages } = JSON.parse(stored);
      if (Date.now() - timestamp > HISTORY_EXPIRATION) {
        localStorage.removeItem(HISTORY_KEY);
        return [];
      }
      console.log("chatMain.js: Loaded", messages.length, "messages from your previous chat...");
      return messages.slice(-MAX_HISTORY_SIZE);
    } catch (error) {
      console.error("chatMain.js: Error loading history:", error);
      localStorage.removeItem(HISTORY_KEY);
      return [];
    }
  }

  // Save history to localStorage
  function saveChatHistory(messages) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify({
        timestamp: Date.now(),
        messages: messages.slice(-MAX_HISTORY_SIZE),
      }));
    } catch (error) {
      console.error("chatMain.js: Error saving history:", error);
    }
  }

  // Append message to chat log
  function appendMessage(sender, text) {
    const chatLog = document.getElementById("chat-log");
    if (!chatLog) return;

    const wrapper = document.createElement("div");
    wrapper.classList.add("chat-text");
    const bubble = document.createElement("div");
    bubble.classList.add(sender === "user" ? "user-text" : "agent-text");
    bubble.innerHTML = formatLinks(text.replace(/\*\*/g, "").replace(/(\r\n|\r|\n)/gm, "<br>"));
    wrapper.appendChild(bubble);
    chatLog.appendChild(wrapper);
    chatLog.scrollTop = chatLog.scrollHeight; // Scroll to bottom

    const history = loadChatHistory();
    history.push({ sender, text });
    saveChatHistory(history); // Save to localStorage
  }

  // Load history into chat log
  function loadHistory(chatLog) {
    const history = loadChatHistory();
    if (!history.length) return;

    chatLog.innerHTML = "";
    const fragment = document.createDocumentFragment();
    history.forEach(({ sender, text }) => {
      const wrapper = document.createElement("div");
      wrapper.classList.add("chat-text");
      const bubble = document.createElement("div");
      bubble.classList.add(sender === "user" ? "user-text" : "agent-text");
      bubble.innerHTML = formatLinks(text.replace(/\*\*/g, "").replace(/(\r\n|\r|\n)/gm, "<br>"));
      wrapper.appendChild(bubble);
      fragment.appendChild(wrapper);
    });
    chatLog.appendChild(fragment);
    chatLog.scrollTop = chatLog.scrollHeight; // Scroll to bottom
  }

  // Debounce utility
  function debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // Initialize chat
  function initChat() {
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const chatLog = document.getElementById("chat-log");
    const sendButton = document.getElementById("send-button");

    if (!chatForm || !chatInput || !chatLog || !sendButton) {
      console.error("chatMain.js: Missing chat elements:", { chatForm, chatInput, chatLog, sendButton });
      return;
    }

    loadHistory(chatLog);

    if (chatForm.dataset.listenersAttached) return;

    chatForm.dataset.listenersAttached = "true";

    const sendMessage = async () => {
      const userMessage = chatInput.value.trim();
      if (!userMessage) return;

      chatInput.disabled = true;
      appendMessage("user", userMessage);
      chatInput.value = "";

      const typingIndicator = document.createElement("div");
      typingIndicator.classList.add("think-text");
      typingIndicator.textContent = "Synthia is thinking...";
      chatLog.appendChild(typingIndicator);
      chatLog.scrollTop = chatLog.scrollHeight; // Scroll to bottom

      try {
        const response = await fetch(API_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatInput: userMessage }),
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const data = await response.json();
        typingIndicator.remove();
        appendMessage("bot", data.response || data.output || "Sorry, no response received.");
      } catch (error) {
        console.error("chatMain.js: Send error:", error);
        typingIndicator.remove();
        appendMessage("bot", `Sorry, something went wrong: ${error.message}`);
      } finally {
        chatInput.disabled = false;
      }
    };

    const debouncedSendMessage = debounce(sendMessage, 300);

    sendButton.addEventListener("click", (e) => {
      e.preventDefault();
      debouncedSendMessage();
    });

    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      debouncedSendMessage();
    });

    // Close button handler - only set up when chat initializes
    const closeButtons = document.querySelectorAll(".dialog-close-button");
    if (closeButtons.length === 0) {
      console.warn("chatMain.js: No close buttons (.dialog-close-button) found in popup.");
    }
    closeButtons.forEach((button) => {
      if (!button.dataset.listenerAttached) {
        button.addEventListener("click", () => {
          console.log("chatMain.js: Synthia deactivated...");
          if (chatLog) {
            chatLog.scrollTop = chatLog.scrollHeight; // Silent scroll restore
          }
        });
        button.dataset.listenerAttached = "true";
      }
    });
  }

  // Trigger setup
  document.addEventListener("DOMContentLoaded", () => {
    console.log("chatMain.js: DOM loaded, awaiting your command...");

    // Manual trigger (e.g., <a href="#synthia">)
    document.querySelectorAll('a[href="#synthia"]').forEach(trigger => {
      trigger.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("chatMain.js: Synthia activated...");
        if (typeof elementorProFrontend?.modules?.popup?.showPopup === "function") {
          elementorProFrontend.modules.popup.showPopup({ id: POPUP_ID });
        }
        setTimeout(() => initChat(), 300); // Delay for popup render
      });
    });

    // Elementor popup show event
    document.addEventListener("elementor/popup/show", (event) => {
      const { popupId } = event.detail || {};
      if (popupId === POPUP_ID) {
        console.log("chatMain.js: Elementor popup shown...");
        setTimeout(() => initChat(), 300); // Delay for popup render
      }
    });

    // Custom reinitialize event
    document.addEventListener("chatReinitialize", () => {
      console.log("chatMain.js: Reinitializing chat...");
      initChat();
    });
  });
})();