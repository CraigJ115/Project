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
      "visitors": "visit.html",
      "whats on": "whatson.html",
      "what's on": "whatson.html",
      "what is on": "whatson.html",
      "collections": "index.html",
      "explore": "index.html",
      "explore the collections": "index.html",
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

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (interactBtn) interactBtn.disabled = true;
    setVoiceStatus("Voice not supported in this browser.");
    return;
  }

  let isListening = false;
  let recognition = null;

  function setActive(active) {
    isListening = active;
    if (interactBtn) {
      interactBtn.classList.toggle("is-listening", active);
      interactBtn.textContent = active ? "🎙 Listening — click to stop" : "Voice control";
    }
    setVoiceStatus(active ? "Listening…" : "");
  }

  function handleTranscript(t) {
    t = t.toLowerCase().trim();
    if (t.includes("stop voice interaction")) { setActive(false); return; }
    if (t.includes("take me to")) { navigateToPage(t.replace(/.*take me to\s*/i, "").replace(/[^a-z0-9\s']/g, "").trim()); return; }
    if (t.includes("scroll down")) { window.scrollBy({ top: 400, behavior: "smooth" }); setVoiceStatus("Scrolling down."); return; }
    if (t.includes("scroll up")) { window.scrollBy({ top: -400, behavior: "smooth" }); setVoiceStatus("Scrolling up."); return; }
    if (t.includes("go to top")) { window.scrollTo({ top: 0, behavior: "smooth" }); setVoiceStatus("Going to top."); return; }
    if (t.includes("go to bottom")) { window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); setVoiceStatus("Going to bottom."); return; }
    setVoiceStatus(`Heard "${t}" — didn't recognise that.`);
  }

  function startRecognition() {
    recognition = new SpeechRecognition();
    recognition.lang = "en-GB";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      handleTranscript(transcript);
    };

    recognition.onend = () => {
      if (isListening) setTimeout(startRecognition, 250);
    };

    recognition.onerror = (e) => {
      if (e.error === "not-allowed") {
        setVoiceStatus("Microphone access denied.");
        setActive(false);
        return;
      }
      if (isListening) setTimeout(startRecognition, 500);
    };

    recognition.start();
  }

  if (interactBtn) {
    interactBtn.addEventListener("click", () => {
      if (!isListening) {
        setActive(true);
        startRecognition();
      } else {
        setActive(false);
        if (recognition) recognition.abort();
      }
    });
  }

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
          <li>Click the <strong>Voice control</strong> button to start listening</li>
          <li>Click again to stop</li>
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
