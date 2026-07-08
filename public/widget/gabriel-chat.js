/**
 * Gabriel Live Chat Widget
 * Embeddable chat widget for customer websites.
 *
 * Usage:
 * <script src="https://your-gabriel-instance.com/widget/gabriel-chat.js"
 *   data-server="https://your-gabriel-instance.com"
 *   data-color="#0F172A"
 *   data-position="right"
 *   data-greeting="Hi! How can we help you today?"
 * ></script>
 */
(function () {
  "use strict";

  var script = document.currentScript;
  var config = {
    server: script.getAttribute("data-server") || window.location.origin,
    color: script.getAttribute("data-color") || "#0F172A",
    position: script.getAttribute("data-position") || "right",
    greeting: script.getAttribute("data-greeting") || "Hi! How can we help you today?",
    title: script.getAttribute("data-title") || "Support Chat",
  };

  var conversationId = null;
  var isOpen = false;

  function createStyles() {
    var style = document.createElement("style");
    style.textContent = "\n\
      #gabriel-widget-container{position:fixed;bottom:20px;" + config.position + ":20px;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}\n\
      #
      iel-widget-btn{width:56px;height:56px;border-radius:50%;background:" + config.color + ";border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.15);transition:transform .2s}\n\
      #gabriel-widget-btn:hover{transform:scale(1.05)}\n\
      #gabriel-widget-btn svg{width:24px;height:24px;fill:#fff}\n\
      #gabriel-widget-panel{display:none;width:370px;height:520px;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.12);margin-bottom:12px;overflow:hidden;flex-direction:column}\n\
      #gabriel-widget-panel.open{display:flex}\n\
      #gabriel-widget-header{background:" + config.color + ";color:#fff;padding:16px;display:flex;align-items:center;justify-content:space-between}\n\
      #gabriel-widget-header h3{margin:0;font-size:15px;font-weight:600}\n\
      #gabriel-widget-close{background:none;border:none;color:#fff;cursor:pointer;font-size:20px;padding:0;line-height:1}\n\
      #gabriel-widget-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}\n\
      .gabriel-msg{max-width:80%;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.4;word-wrap:break-word}\n\
      .gabriel-msg.bot{background:#F1F5F9;color:#1E293B;align-self:flex-start;border-bottom-left-radius:4px}\n\
      .gabriel-msg.user{background:" + config.color + ";color:#fff;align-self:flex-end;border-bottom-right-radius:4px}\n\
      .gabriel-msg.typing{color:#94A3B8;font-style:italic}\n\
      #gabriel-widget-input{display:flex;border-top:1px solid #E2E8F0;padding:12px}\n\
      #gabriel-widget-input input{flex:1;border:1px solid #E2E8F0;border-radius:8px;padding:10px 14px;font-size:14px;outline:none}\n\
      #gabriel-widget-input input:focus{border-color:" + config.color + "}\n\
      #gabriel-widget-input button{background:" + config.color + ";color:#fff;border:none;border-radius:8px;padding:10px 16px;margin-left:8px;cursor:pointer;font-size:14px}\n\
    ";
    document.head.appendChild(style);
  }

  function createWidget() {
    var container = document.createElement("div");
    container.id = "gabriel-widget-container";
    container.innerHTML = '\
      <div id="gabriel-widget-panel">\
        <div id="gabriel-widget-header">\
          <h3>' + config.title + '</h3>\
          <button id="gabriel-widget-close">&times;</button>\
        </div>\
        <div id="gabriel-widget-messages"></div>\
        <div id="gabriel-widget-input">\
          <input type="text" placeholder="Type a message..." id="gabriel-widget-text" />\
          <button id="gabriel-widget-send">Send</button>\
        </div>\
      </div>\
      <button id="gabriel-widget-btn">\
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>\
      </button>\
    ';
    document.body.appendChild(container);

    document.getElementById("gabriel-widget-btn").onclick = toggleWidget;
    document.getElementById("gabriel-widget-close").onclick = toggleWidget;
    document.getElementById("gabriel-widget-send").onclick = sendMessage;
    document.getElementById("gabriel-widget-text").onkeypress = function (e) {
      if (e.key === "Enter") sendMessage();
    };
  }

  function toggleWidget() {
    isOpen = !isOpen;
    var panel = document.getElementById("gabriel-widget-panel");
    panel.classList.toggle("open", isOpen);
    if (isOpen && !document.querySelector(".gabriel-msg")) {
      addMessage(config.greeting, "bot");
    }
  }

  function addMessage(text, type) {
    var messages = document.getElementById("gabriel-widget-messages");
    var msg = document.createElement("div");
    msg.className = "gabriel-msg " + type;
    msg.textContent = text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  function sendMessage() {
    var input = document.getElementById("gabriel-widget-text");
    var text = input.value.trim();
    if (!text) return;

    addMessage(text, "user");
    input.value = "";

    var typing = addMessage("Typing...", "bot typing");

    fetch(config.server + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        conversationId: conversationId,
        channel: "widget",
        customerName: "Website Visitor",
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        typing.remove();
        conversationId = data.conversationId;
        addMessage(data.response || "Sorry, I could not process your request.", "bot");
      })
      .catch(function () {
        typing.remove();
        addMessage("Connection error. Please try again.", "bot");
      });
  }

  // Initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      createStyles();
      createWidget();
    });
  } else {
    createStyles();
    createWidget();
  }
})();
