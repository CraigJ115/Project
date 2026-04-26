document.addEventListener("DOMContentLoaded", () => {
  const interactBtn = document.getElementById("btn-voice-interact");

  function setVoiceStatus(msg) {
    const el = document.getElementById("voice-status");
    if (el) el.textContent = msg;
  }

  function navigateToPage(page) {
    const p = (page || "").trim().toLowerCase().replace(/[^a-z0-9\s']/g, "").trim();
    const map = {
      "visit": "visit.html",
      "visit us": "visit.html",
      "whats on": "whatson.html",
      "what's on": "whatson.html",
      "what is on": "whatson.html",
      "collections": "website project.html",
      "explore": "website project.html",
      "explore the collections": "website project.html",
      "learn": "learn.html",
      "join": "join.html",
      "join and support": "join.html",
      "support": "join.html",
      "shop": "shop.html",
    };
    const url = map[p];
    if (url) {
      setVoiceStatus(`Taking you to ${page}…`);
      window.location.href = url;
    } else {
      setVoiceStatus(`Couldn't find a page called "${page}".`);
    }
  }

  if (!window.annyang) {
    if (interactBtn) interactBtn.disabled = true;
    return;
  }

  annyang.removeCommands();
  let isListening = false;

  function setActive(active) {
    isListening = active;
    if (interactBtn) {
      interactBtn.classList.toggle("is-listening", active);
      interactBtn.textContent = active ? "🎙 Listening — click to stop" : "Voice control";
    }
    setVoiceStatus(active ? "Listening…" : "");
  }

  annyang.addCommands({
    "start voice interaction": () => { if (!isListening) setActive(true); },
    "stop voice interaction": () => { if (isListening) setActive(false); },
    "take me to *page": (page) => { if (!isListening) return; navigateToPage(page); },
    "scroll *direction": (direction) => {
      if (!isListening) return;
      const d = (direction || "").toLowerCase();
      if (d.includes("down")) { window.scrollBy({ top: 400, behavior: "smooth" }); setVoiceStatus("Scrolling down."); }
      else if (d.includes("up")) { window.scrollBy({ top: -400, behavior: "smooth" }); setVoiceStatus("Scrolling up."); }
    },
    "go to top": () => { if (!isListening) return; window.scrollTo({ top: 0, behavior: "smooth" }); setVoiceStatus("Going to top."); },
    "go to bottom": () => { if (!isListening) return; window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); setVoiceStatus("Going to bottom."); },
  });

  annyang.addCallback("resultNoMatch", (phrases) => {
    const t = ((phrases && phrases[0]) || "").toLowerCase().trim();
    if (t.includes("start voice interaction")) { if (!isListening) setActive(true); return; }
    if (t.includes("stop voice interaction")) { if (isListening) setActive(false); return; }
    if (!isListening) return;
    if (t.includes("take me to")) { navigateToPage(t.replace(/.*take me to\s*/i, "").replace(/[^a-z0-9\s']/g, "").trim()); return; }
    if (t.includes("scroll down")) { window.scrollBy({ top: 400, behavior: "smooth" }); setVoiceStatus("Scrolling down."); return; }
    if (t.includes("scroll up")) { window.scrollBy({ top: -400, behavior: "smooth" }); setVoiceStatus("Scrolling up."); return; }
    setVoiceStatus("Didn't catch that — still listening…");
  });

  annyang.addCallback("end", () => { setTimeout(() => annyang.start({ autoRestart: true, continuous: true }), 300); });
  annyang.addCallback("error", () => { setTimeout(() => annyang.start({ autoRestart: true, continuous: true }), 300); });

  annyang.start({ autoRestart: true, continuous: true });

  if (interactBtn) interactBtn.addEventListener("click", () => setActive(!isListening));

  document.getElementById("btn-show-help")?.addEventListener("click", showHelpModal);
});

function showHelpModal() {
  const root = document.getElementById("help-modal-root");
  if (!root) return;
  root.innerHTML = `
    <div class="welcome-modal-backdrop" id="help-backdrop">
      <div class="welcome-modal">
        <h1>Voice Commands</h1>
        <h2>Activate Voice</h2>
        <ul>
          <li>Say <strong>"start voice interaction"</strong> or click the button to activate</li>
          <li>Say <strong>"stop voice interaction"</strong> or click again to deactivate</li>
        </ul>
        <h2>Navigate Pages</h2>
        <ul>
          <li>"take me to visit", "take me to shop", "take me to learn"</li>
          <li>"take me to what's on", "take me to join", "take me to collections"</li>
        </ul>
        <h2>Scroll</h2>
        <ul>
          <li>"scroll down", "scroll up", "go to top", "go to bottom"</li>
        </ul>
        <button class="welcome-modal-close" id="btn-help-close">Got it</button>
      </div>
    </div>
  `;
  document.getElementById("btn-help-close")?.addEventListener("click", () => { root.innerHTML = ""; });
  document.getElementById("help-backdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "help-backdrop") root.innerHTML = "";
  });
}
