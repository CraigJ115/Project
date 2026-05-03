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
      "visiting": "visit.html",
      "plan a visit": "visit.html",
      "plan my visit": "visit.html",
      "plan your visit": "visit.html",
      "whats on": "whatson.html",
      "what's on": "whatson.html",
      "what is on": "whatson.html",
      "what on": "whatson.html",
      "watson": "whatson.html",
      "what son": "whatson.html",
      "events": "whatson.html",
      "exhibitions": "whatson.html",
      "whats happening": "whatson.html",
      "what's happening": "whatson.html",
      "courses": "whatson.html",
      "collections": "index.html",
      "collection": "index.html",
      "explore": "index.html",
      "explore the collections": "index.html",
      "the collections": "index.html",
      "search": "index.html",
      "browse": "index.html",
      "home": "index.html",
      "learn": "learn.html",
      "learning": "learn.html",
      "education": "learn.html",
      "schools": "learn.html",
      "study": "learn.html",
      "research": "learn.html",
      "researchers": "learn.html",
      "join": "join.html",
      "join and support": "join.html",
      "join us": "join.html",
      "support": "join.html",
      "membership": "join.html",
      "members": "join.html",
      "member": "join.html",
      "donate": "join.html",
      "donation": "join.html",
      "shop": "shop.html",
      "shopping": "shop.html",
      "store": "shop.html",
      "buy": "shop.html",
      "gifts": "shop.html",
      "gift": "shop.html",
    };
    const url = map[p];
    if (url) {
      setVoiceStatus(`Taking you to ${page}…`);
      window.location.href = url;
      return true;
    }
    return false;
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
    "stop voice interaction":  () => { if (isListening) setActive(false); },
    "take me to *page": (page) => { navigateToPage(page); },
    "scroll *direction": (direction) => {
      if (!isListening) return;
      const d = (direction || "").toLowerCase();
      if (d.includes("down")) { window.scrollBy({ top: 400, behavior: "smooth" }); setVoiceStatus("Scrolling down."); }
      else if (d.includes("up")) { window.scrollBy({ top: -400, behavior: "smooth" }); setVoiceStatus("Scrolling up."); }
    },
    "go to top":    () => { if (!isListening) return; window.scrollTo({ top: 0, behavior: "smooth" }); setVoiceStatus("Going to top."); },
    "go to bottom": () => { if (!isListening) return; window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); setVoiceStatus("Going to bottom."); },
  });

  annyang.addCallback("result", (phrases) => {
    console.log("[voice] matched:", phrases);
  });

  annyang.addCallback("resultNoMatch", (phrases) => {
    const t = ((phrases && phrases[0]) || "").toLowerCase().trim();
    console.log("[voice] no match, heard:", phrases);
    if (t.includes("start voice interaction")) { if (!isListening) setActive(true); return; }
    if (t.includes("stop voice interaction"))  { if (isListening) setActive(false); return; }
    if (t.includes("take me to")) { navigateToPage(t.replace(/.*take me to\s*/i, "").replace(/[^a-z0-9\s']/g, "").trim()); return; }
    if (!isListening) return;
    if (t.includes("scroll down")) { window.scrollBy({ top: 400, behavior: "smooth" }); setVoiceStatus("Scrolling down."); return; }
    if (t.includes("scroll up"))   { window.scrollBy({ top: -400, behavior: "smooth" }); setVoiceStatus("Scrolling up."); return; }

    // fallback: if "take me to" was misheard, check if the last word(s) are a known page
    const words = t.replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/);
    const last1 = words.slice(-1).join(" ");
    const last2 = words.slice(-2).join(" ");
    const last3 = words.slice(-3).join(" ");
    for (const chunk of [last3, last2, last1]) {
      const result = navigateToPage(chunk);
      if (result) return;
    }

    setVoiceStatus("Didn't catch that — still listening…");
  });

  annyang.addCallback("start", () => { console.log("[voice] recognition started"); });
  annyang.addCallback("end",   () => { console.log("[voice] recognition ended"); setTimeout(() => annyang.start({ autoRestart: true, continuous: true }), 300); });
  annyang.addCallback("error", (err) => { console.log("[voice] error:", err?.error); setTimeout(() => annyang.start({ autoRestart: true, continuous: true }), 300); });

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
