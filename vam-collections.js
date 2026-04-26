// main API bits
const BASE_URL = "https://api.vam.ac.uk/v2/objects/search";
const makeImgUrl = (id, width) =>
  `https://framemark.vam.ac.uk/collections/${id}/full/${width},/0/default.jpg`;

// grab data from the V&A API
async function fetchData(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`V&A API error (${res.status})`);
  return res.json();
}

// app state
let state = {
  inputVal: "car",
  query: "car",
  page: 1,
  pageSize: 10,
  results: [],
  total: 0,
  loading: true,
  error: null,
  selectedId: null,
  modalData: null,
  modalLoading: false,
  similarItems: [],
  similarLoading: false,
  showSimilarItems: false,
  viewHistory: [],
  showRecommendations: false,
  recommendations: [],
  recommendationsLoading: false,
};

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

// load search results
async function loadResults() {
  setState({ loading: true, error: null });
  const { query, page, pageSize } = state;
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (query) params.set("q", query);
  try {
    const data = await fetchData(`${BASE_URL}?${params}`);
    setState({
      results: data.records || [],
      total: data.info?.record_count || 0,
      loading: false,
    });
  } catch (err) {
    setState({ error: err.message, loading: false });
  }
}

// open modal with one object
async function openModal(id) {
  setState({
    selectedId: id,
    modalData: null,
    modalLoading: true,
    similarItems: [],
    similarLoading: false,
    showSimilarItems: false,
  });
  try {
    const data = await fetchData(`https://api.vam.ac.uk/v2/museumobject/${id}`);
    const record = data.record;
    const entry = {
      id,
      title: record.titles?.[0]?.title || record._primaryTitle || "Untitled",
      objectType: record.objectType || "",
      category: record.categories?.[0]?.text || "",
    };
    const alreadySeen = state.viewHistory.some((h) => h.id === id);
    if (!alreadySeen) {
      state = { ...state, viewHistory: [...state.viewHistory, entry] };
    }
    setState({ modalData: record, modalLoading: false });
  } catch {
    setState({ modalLoading: false, similarLoading: false });
  }
}

function closeModal() {
  setState({ selectedId: null, modalData: null, showSimilarItems: false });
  document.body.style.overflow = "";
}

// fetch similar items based on object type or category
async function fetchSimilarItems(modalData) {
  if (!modalData) { setState({ similarLoading: false }); return; }
  const type = modalData.objectType || "";
  const category = modalData.categories?.[0]?.text || "";
  const searchTerm = type || category;
  if (!searchTerm) { setState({ similarLoading: false }); return; }
  try {
    const params = new URLSearchParams({ q: searchTerm, page_size: 4 });
    const data = await fetchData(`${BASE_URL}?${params}`);
    setState({
      similarItems: (data.records || []).slice(0, 4),
      similarLoading: false,
    });
  } catch {
    setState({ similarLoading: false });
  }
}

// build recommendations from view history
async function fetchRecommendations() {
  const { viewHistory } = state;
  if (!viewHistory.length) {
    setState({ recommendationsLoading: false, recommendations: [] });
    return;
  }

  const tally = {};
  viewHistory.forEach(({ objectType, category }) => {
    [objectType, category].filter(Boolean).forEach((term) => {
      tally[term] = (tally[term] || 0) + 1;
    });
  });

  const topTerms = Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([term]) => term);

  try {
    const results = await Promise.all(
      topTerms.map((term) =>
        fetchData(`${BASE_URL}?${new URLSearchParams({ q: term, page_size: 4 })}`)
          .then((d) => d.records || [])
          .catch(() => [])
      )
    );
    const seenIds = new Set(viewHistory.map((h) => h.id));
    const flat = results.flat().filter((r) => !seenIds.has(r.systemNumber));
    const unique = [...new Map(flat.map((r) => [r.systemNumber, r])).values()].slice(0, 12);
    setState({ recommendations: unique, recommendationsLoading: false });
  } catch {
    setState({ recommendationsLoading: false });
  }
}

function showRecommendationsPanel() {
  const { viewHistory } = state;
  if (!viewHistory.length) {
    setVoiceStatus("View some items first and I'll recommend similar ones.");
    return;
  }
  setState({ showRecommendations: true, recommendationsLoading: true, recommendations: [] });
  fetchRecommendations();
}

function makeRecommendationsModal() {
  const { showRecommendations, recommendations, recommendationsLoading, viewHistory } = state;
  if (!showRecommendations) return "";

  let body = "";
  if (!viewHistory.length) {
    body = `<p class="rec-empty">Browse some items first and I'll suggest similar ones.</p>`;
  } else if (recommendationsLoading) {
    body = `<div style="padding:2rem;display:flex;align-items:center;gap:1rem"><div class="spinner"></div><span>Finding recommendations…</span></div>`;
  } else if (!recommendations.length) {
    body = `<p class="rec-empty">No recommendations found right now — try viewing more items.</p>`;
  } else {
    body = `<div class="rec-grid">${recommendations.map(makeSimilarCard).join("")}</div>`;
  }

  const basedOn = viewHistory
    .slice(-3)
    .map((h) => escapeHTML(h.title.length > 25 ? h.title.substring(0, 22) + "…" : h.title))
    .join(", ");

  return `
    <div class="welcome-modal-backdrop" id="rec-backdrop">
      <div class="welcome-modal rec-modal">
        <button class="welcome-modal-close" id="btn-rec-close" style="float:right">✕ Close</button>
        <h1>Recommended for You</h1>
        <p class="rec-subtitle">Based on items you've viewed: <em>${basedOn}</em></p>
        ${body}
      </div>
    </div>
  `;
}

// stop random html chaos
function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function noImageHTML() {
  return `<div class="no-img-msg">No image available</div>`;
}

function makeSimilarCard(item) {
  const imgId = item._primaryImageId;
  const title = item._primaryTitle || "Untitled";
  return `
    <div class="similar-card" data-id="${item.systemNumber}" title="${escapeHTML(title)}">
      <div class="similar-card-img">${makeImg(imgId, "100", title)}</div>
      <div class="similar-card-title">${escapeHTML(title.length > 30 ? title.substring(0, 27) + "..." : title)}</div>
    </div>
  `;
}

function makeImg(imgId, size, title) {
  if (!imgId) return noImageHTML();
  const src = makeImgUrl(imgId, size);
  return `<img src="${src}" alt="${escapeHTML(title)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'no-img-msg',textContent:'No image available'}))">`;
}

function locationIcon() {
  return `<svg width="10" height="13" viewBox="0 0 10 13" fill="currentColor"><path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 8 5 8s5-4.25 5-8c0-2.76-2.24-5-5-5zm0 6.75A1.75 1.75 0 1 1 5 3.25a1.75 1.75 0 0 1 0 3.5z"/></svg>`;
}

function makeGridCard(item, index) {
  const imgId = item._primaryImageId;
  const title = item._primaryTitle || "Untitled";
  const makerName = item._primaryMaker?.name || "";
  const date = item._primaryDate || "";
  const place = item._currentLocation?.displayName || "";
  const onDisplay = item.onDisplay;
  return `
    <div class="card-grid" data-id="${item.systemNumber}">
      <div class="card-img-wrap">
        <span class="card-number">${index + 1}</span>
        ${makeImg(imgId, "200", title)}
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHTML(title)}</div>
        ${makerName ? `<div class="card-maker">${escapeHTML(makerName)}</div>` : ""}
        ${date ? `<div class="card-date">${escapeHTML(date)}</div>` : ""}
        ${place ? `<div class="card-location">${locationIcon()} ${escapeHTML(place)}</div>` : ""}
        <div class="${onDisplay ? "on-display-label yes" : "not-on-display"}">${onDisplay ? "On display" : "Not on display"}</div>
      </div>
    </div>
  `;
}

function makePagination() {
  const { page, total, pageSize } = state;
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return { paginationHtml: "" };

  const pageSet = new Set([1, totalPages]);
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) pageSet.add(i);
  const pages = [...pageSet].sort((a, b) => a - b);

  let html = `<div class="pagination">`;
  html += `<button class="btn-page" data-page="${page - 1}" ${page === 1 ? "disabled" : ""}>‹ Back</button>`;
  pages.forEach((pg, i) => {
    const prev = pages[i - 1];
    if (prev && pg - prev > 1) html += `<span class="pagination-ellipsis">…</span>`;
    html += `<button class="btn-page${pg === page ? " active" : ""}" data-page="${pg}">${String(pg).padStart(2, "0")}</button>`;
  });
  html += `<button class="btn-page" data-page="${page + 1}" ${page === totalPages ? "disabled" : ""}>Next</button>`;
  html += `</div>`;

  return { paginationHtml: html };
}

function makeModal() {
  const { selectedId, modalData, modalLoading, similarItems, similarLoading, showSimilarItems } = state;
  if (!selectedId) return "";

  let body = "";

  if (modalLoading) {
    body = `<div style="width:100%;padding:4rem;display:flex;align-items:center;justify-content:center"><div class="spinner"></div></div>`;
  } else if (!modalData) {
    body = `<p class="modal-error">Could not load details.</p>`;
  } else {
    const imgId = modalData.images?.[0]?.imageId || modalData.images?.[0] || "";
    const title = modalData.titles?.[0]?.title || modalData._primaryTitle || "Untitled";
    const maker = modalData.artistMakerPerson?.[0]?.name?.text || modalData.artistMakerOrganisations?.[0]?.name?.text || "";
    const date = modalData.productionDates?.[0]?.date?.text || "";
    const type = modalData.objectType || "";
    const materials = modalData.materials?.map((m) => m.text).join(", ") || "";
    const place = modalData.productionPlaces?.[0]?.place?.text || "";
    const desc = modalData.briefDescription || "";
    const accession = modalData.accessionNumber || selectedId;

    const rows = [
      ["Maker", maker],
      ["Date", date],
      ["Place", place],
      ["Materials", materials],
      ["Accession", accession],
    ]
      .filter(([, val]) => val)
      .map(([label, val]) => `
        <div class="modal-meta-row">
          <span class="modal-meta-key">${label}</span>
          <span>${escapeHTML(val)}</span>
        </div>`)
      .join("");

    const similarHtml = showSimilarItems
      ? similarLoading
        ? `<div class="similar-section"><p>Loading similar items...</p></div>`
        : similarItems.length > 0
        ? `<div class="similar-section"><h3>More like this</h3><div class="similar-items-grid">${similarItems.map(item => makeSimilarCard(item)).join("")}</div></div>`
        : ""
      : "";

    body = `
      <div class="modal-img-panel">${makeImg(imgId, "500", title)}</div>
      <div class="modal-info-panel">
        ${type ? `<div class="modal-object-type">${escapeHTML(type)}</div>` : ""}
        <h2 class="modal-title">${escapeHTML(title)}</h2>
        <div class="modal-meta">${rows}</div>
        ${desc ? `<div class="modal-desc">${escapeHTML(desc)}</div>` : ""}
        <button class="more-like-this-btn" id="btn-more-like-this">Find more like this</button>
        ${similarHtml}
      </div>
    `;
  }

  return `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <button class="modal-close" id="btn-modal-close">×</button>
        ${body}
      </div>
    </div>
  `;
}

// main render
function render() {
  const { inputVal, query, results, total, loading, error, selectedId } = state;

  const input = document.getElementById("search-input");
  if (input && document.activeElement !== input) input.value = inputVal;

  const countEl = document.getElementById("result-count");
  const queryEl = document.getElementById("result-query");
  if (countEl) {
    if (loading) {
      countEl.textContent = "Searching...";
      if (queryEl) queryEl.textContent = "";
    } else if (error) {
      countEl.innerHTML = `<span style="color:#c0392b;font-size:15px">Error: ${escapeHTML(error)}</span>`;
    } else {
      countEl.textContent = `${total.toLocaleString()} objects`;
      if (queryEl) queryEl.textContent = query ? `matching "${query}"` : "";
    }
  }

  const resultsEl = document.getElementById("results");
  if (resultsEl) {
    if (loading) {
      resultsEl.innerHTML = `<div class="state-center"><div class="spinner"></div><p>Searching the collection...</p></div>`;
    } else if (error) {
      resultsEl.innerHTML = `<div class="state-center"><p style="color:#c0392b">Something went wrong loading the results.</p></div>`;
    } else if (!results.length) {
      resultsEl.innerHTML = `<div class="state-center"><p style="font-size:16px;margin-bottom:6px">No results found</p><p>Try searching for something else.</p></div>`;
    } else {
      resultsEl.innerHTML = `<div class="results-grid">${results.map((item, i) => makeGridCard(item, i)).join("")}</div>`;
    }
  }

  const { paginationHtml } = loading ? { paginationHtml: "" } : makePagination();
  const paginationEl = document.getElementById("pagination");
  if (paginationEl) paginationEl.innerHTML = paginationHtml;

  const modalRoot = document.getElementById("modal-root");
  if (modalRoot) {
    modalRoot.innerHTML = makeModal();
    if (selectedId) document.body.style.overflow = "hidden";
  }

  const recRoot = document.getElementById("rec-modal-root");
  if (recRoot) recRoot.innerHTML = makeRecommendationsModal();

  attachEventsAgain();
}

// re-attach events after render because innerHTML wipes them out
function attachEventsAgain() {
  document.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", () => openModal(el.dataset.id));
  });

  document.querySelectorAll("[data-page]").forEach((btn) => {
    if (!btn.disabled) {
      btn.addEventListener("click", () => {
        setState({ page: Number(btn.dataset.page) });
        loadResults();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  });

  const backdrop = document.getElementById("modal-backdrop");
  if (backdrop) backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });

  const closeBtn = document.getElementById("btn-modal-close");
  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  const recBackdrop = document.getElementById("rec-backdrop");
  if (recBackdrop) recBackdrop.addEventListener("click", (e) => {
    if (e.target === recBackdrop) setState({ showRecommendations: false });
  });

  const recCloseBtn = document.getElementById("btn-rec-close");
  if (recCloseBtn) recCloseBtn.addEventListener("click", () => setState({ showRecommendations: false }));

  document.querySelectorAll(".rec-grid [data-id]").forEach((el) => {
    el.addEventListener("click", () => {
      setState({ showRecommendations: false });
      openModal(el.dataset.id);
    });
  });

  const moreLikeBtn = document.getElementById("btn-more-like-this");
  if (moreLikeBtn) moreLikeBtn.addEventListener("click", runMoreLikeThis);
}

// stuff that only needs setting up once
document.addEventListener("DOMContentLoaded", () => {
  showWelcomeModal();

  document.getElementById("btn-show-help")?.addEventListener("click", showWelcomeModal);

  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("btn-search-go");

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const val = e.target.value.trim().toLowerCase();
      if (val.includes("recommendation")) {
        searchInput.value = "";
        state = { ...state, inputVal: "" };
        showRecommendationsPanel();
        return;
      }
      setState({ query: e.target.value, page: 1 });
      loadResults();
    }
  });

  searchInput.addEventListener("input", (e) => {
    state = { ...state, inputVal: e.target.value };
  });

  searchBtn.addEventListener("click", () => {
    const val = state.inputVal.trim().toLowerCase();
    if (val.includes("recommendation")) {
      const input = document.getElementById("search-input");
      if (input) input.value = "";
      state = { ...state, inputVal: "" };
      showRecommendationsPanel();
      return;
    }
    setState({ query: state.inputVal, page: 1 });
    loadResults();
  });

  render();
  loadResults();
  initVoice();
});

// ── Welcome modal ──────────────────────────────────────────
function showWelcomeModal() {
  const html = `
    <div class="welcome-modal-backdrop" id="welcome-backdrop">
      <div class="welcome-modal">
        <h1>Welcome to V&A Collections Explorer</h1>

        <h2>How to Use:</h2>
        <ul>
          <li><strong>Search:</strong> Type in the box or say "search for [item]" to find objects</li>
          <li><strong>Voice Control:</strong> Say "start voice interaction" or click the button to activate voice commands</li>
          <li><strong>Item Details:</strong> Click any item to see full details and similar pieces</li>
          <li><strong>Navigate:</strong> Use pagination or voice commands like "next page" and "previous page"</li>
        </ul>

        <h2>Voice Commands:</h2>
        <ul>
          <li><strong>Scrolling:</strong> "scroll down", "scroll up", "go to top", "go to bottom"</li>
          <li><strong>Navigation:</strong> "next page", "previous page", "first page"</li>
          <li><strong>Results:</strong> "select image 1" through "select image 10"</li>
          <li><strong>Modal:</strong> "close", "more like this"</li>
          <li><strong>Search:</strong> "search for [item]"</li>
          <li><strong>Recommendations:</strong> say "show me recommendations" to see items based on your history</li>
          <li><strong>Navigation:</strong> say "take me to shop", "take me to learn", "take me to visit" etc. to go to another page</li>
          <li><strong>Help:</strong> say "help" to reopen this screen</li>
        </ul>

        <button class="welcome-modal-close" id="btn-welcome-close">Get Started</button>
      </div>
    </div>
  `;

  const root = document.getElementById("welcome-modal-root");
  if (root) {
    root.innerHTML = html;
    document.getElementById("btn-welcome-close")?.addEventListener("click", () => { root.innerHTML = ""; });
    document.getElementById("welcome-backdrop")?.addEventListener("click", (e) => {
      if (e.target.id === "welcome-backdrop") root.innerHTML = "";
    });
  }
}

// ── Voice helpers ──────────────────────────────────────────
const synonyms = {
  doll: "dolls", toy: "toys", bike: "bicycle", bicycle: "bicycles",
  dress: "fashion", clothes: "fashion", clothing: "fashion", hat: "hats",
  gun: "firearms", sword: "swords", knife: "knives", weapon: "weapons",
  clock: "timepieces", watch: "watches", timepiece: "timepieces",
  ring: "jewellery", necklace: "jewellery", jewel: "jewellery", jewelry: "jewellery",
  phone: "telephones", telephone: "telephones",
  chair: "furniture", table: "furniture", sofa: "furniture",
  pot: "ceramics", vase: "ceramics", bowl: "ceramics", cup: "ceramics",
  painting: "paintings", drawing: "drawings", print: "prints",
  photo: "photographs", photograph: "photographs", picture: "photographs",
  book: "books", map: "maps", poster: "posters",
  shoe: "shoes", boot: "boots", bag: "bags",
  lamp: "lighting", light: "lighting", candle: "candlesticks",
  coin: "coins", medal: "medals", stamp: "stamps",
  ship: "ships", boat: "boats", plane: "aircraft", airplane: "aircraft",
  train: "railways", railway: "railways",
  god: "religion", church: "religion", cross: "religion",
};

function setVoiceStatus(message) {
  const statusEl = document.getElementById("voice-status");
  if (statusEl) statusEl.textContent = message;
}

function runVoiceSearch(term) {
  const cleanTerm = (term || "").trim().toLowerCase();
  if (!cleanTerm) { setVoiceStatus("Didn't catch that."); return; }
  if (cleanTerm.includes("recommendation")) { showRecommendationsPanel(); return; }
  const searchTerm = synonyms[cleanTerm] || term;
  const input = document.getElementById("search-input");
  if (input) input.value = searchTerm;
  setVoiceStatus(`Searching for "${searchTerm}"`);
  setState({ inputVal: searchTerm, query: searchTerm, page: 1 });
  loadResults();
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

function runMoreLikeThis() {
  const { modalData } = state;
  if (!modalData) { setVoiceStatus("No item is open."); return; }
  const type = modalData.objectType || "";
  const category = modalData.categories?.[0]?.text || "";
  const searchTerm = type || category;
  if (!searchTerm) { setVoiceStatus("Couldn't find anything similar for this one."); return; }
  setVoiceStatus(`Finding more like "${searchTerm}"`);
  setState({ showSimilarItems: true, similarLoading: true });
  fetchSimilarItems(modalData);
}

function openResultByIndex(index) {
  const { results } = state;
  if (!results.length) { setVoiceStatus("No results to open."); return; }
  if (index >= results.length) { setVoiceStatus(`Only ${results.length} results showing right now.`); return; }
  openModal(results[index].systemNumber);
  setVoiceStatus(`Opening result ${index + 1}`);
}

function goNextPage() {
  const { page, total, pageSize } = state;
  const totalPages = Math.ceil(total / pageSize);
  if (page < totalPages) {
    setState({ page: page + 1 }); loadResults();
    window.scrollTo({ top: 0, behavior: "smooth" }); setVoiceStatus("Next page.");
  } else { setVoiceStatus("Already on the last page."); }
}

function goPrevPage() {
  if (state.page > 1) {
    setState({ page: state.page - 1 }); loadResults();
    window.scrollTo({ top: 0, behavior: "smooth" }); setVoiceStatus("Previous page.");
  } else { setVoiceStatus("Already on the first page."); }
}

const NUMBER_WORDS = {
  one:1, two:2, three:3, four:4, five:5,
  six:6, seven:7, eight:8, nine:9, ten:10,
};

function parseSpokenNumber(str) {
  const clean = (str || "").trim().toLowerCase();
  if (NUMBER_WORDS[clean]) return NUMBER_WORDS[clean];
  const n = parseInt(clean, 10);
  return isNaN(n) ? null : n;
}

function initVoice() {
  const interactBtn = document.getElementById("btn-voice-interact");

  if (!window.annyang) {
    if (interactBtn) interactBtn.disabled = true;
    setVoiceStatus("Voice search unavailable.");
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

  const commands = {
    "start voice interaction": () => { if (!isListening) setActive(true); },
    "scroll *direction": (direction) => {
      if (!isListening) return;
      const d = (direction || "").trim().toLowerCase();
      const modal = state.selectedId ? document.querySelector(".modal") : null;
      if (d.includes("down")) {
        if (modal) modal.scrollBy({ top: 400, behavior: "smooth" });
        else window.scrollBy({ top: 400, behavior: "smooth" });
        setVoiceStatus("Scrolling down.");
      } else if (d.includes("up")) {
        if (modal) modal.scrollBy({ top: -400, behavior: "smooth" });
        else window.scrollBy({ top: -400, behavior: "smooth" });
        setVoiceStatus("Scrolling up.");
      }
    },
    "go to top": () => {
      if (!isListening) return;
      if (state.selectedId) {
        const modal = document.querySelector(".modal");
        if (modal) { modal.scrollTo({ top: 0, behavior: "smooth" }); setVoiceStatus("Going to top of modal."); }
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" }); setVoiceStatus("Going to top.");
      }
    },
    "go to bottom": () => {
      if (!isListening) return;
      if (state.selectedId) {
        const modal = document.querySelector(".modal");
        if (modal) { modal.scrollTo({ top: modal.scrollHeight, behavior: "smooth" }); setVoiceStatus("Going to bottom of modal."); }
      } else {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); setVoiceStatus("Going to bottom.");
      }
    },
    "search for *term": (term) => { if (!isListening) return; runVoiceSearch(term); },
    "take me to *page": (page) => { if (!isListening) return; navigateToPage(page); },
  };

  annyang.addCommands(commands);

  annyang.addCallback("start", () => {
    if (isListening) setVoiceStatus("Listening…");
  });

  // Always restart annyang to keep passive wake-word detection alive
  annyang.addCallback("end", () => {
    setTimeout(() => annyang.start({ autoRestart: true, continuous: true }), 300);
  });

  annyang.addCallback("error", () => {
    setTimeout(() => annyang.start({ autoRestart: true, continuous: true }), 300);
  });

  annyang.addCallback("resultNoMatch", (phrases) => {
    const t = ((phrases && phrases[0]) || "").toLowerCase().trim();

    if (t.includes("start voice interaction")) { if (!isListening) setActive(true); return; }
    if (!isListening) return;

    if (t.includes("next page"))                              { goNextPage(); return; }
    if (t.includes("previous page") || t.includes("prev page") || t.includes("go back")) { goPrevPage(); return; }
    if (t.includes("first page"))                             { setState({ page: 1 }); loadResults(); window.scrollTo({ top: 0, behavior: "smooth" }); setVoiceStatus("Back to page one."); return; }
    if (t.includes("scroll down"))                            { const m = state.selectedId ? document.querySelector(".modal") : null; if (m) m.scrollBy({ top: 400, behavior: "smooth" }); else window.scrollBy({ top: 400, behavior: "smooth" }); setVoiceStatus("Scrolling down."); return; }
    if (t.includes("scroll up"))                              { const m = state.selectedId ? document.querySelector(".modal") : null; if (m) m.scrollBy({ top: -400, behavior: "smooth" }); else window.scrollBy({ top: -400, behavior: "smooth" }); setVoiceStatus("Scrolling up."); return; }
    if (t.includes("close"))                                  { if (state.selectedId) { closeModal(); setVoiceStatus("Closed."); } return; }
    if (t.includes("recommendation"))                         { showRecommendationsPanel(); return; }
    if (t.includes("more like") || (t.includes("show") && t.includes("more"))) { runMoreLikeThis(); return; }
    if (t.includes("help"))                                   { showWelcomeModal(); return; }
    if (t.includes("take me to"))                             { navigateToPage(t.replace(/.*take me to\s*/i, "").replace(/[^a-z0-9\s']/g, "").trim()); return; }

    const selectMatch = t.match(/select image\s+(\w+)/);
    if (selectMatch) { const idx = parseSpokenNumber(selectMatch[1]); if (idx !== null) { openResultByIndex(idx - 1); return; } }

    setVoiceStatus("Didn't catch that — still listening…");
  });

  // Start passive always-on listening for wake phrase
  annyang.start({ autoRestart: true, continuous: true });

  if (interactBtn) interactBtn.addEventListener("click", () => setActive(!isListening));
}