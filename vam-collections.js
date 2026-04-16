// ── Constants ──────────────────────────────────────────────
const BASE    = "https://api.vam.ac.uk/v2/objects/search";
const IMG_URL = (id, w) => `https://framemark.vam.ac.uk/collections/${id}/full/${w},/0/default.jpg`;
const VAM_URL = (sysn) => `https://collections.vam.ac.uk/item/${sysn}/`;

// ── API helper — calls V&A directly, no key needed ─────────
async function vamFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`V&A API error ${res.status}`);
  return res.json();
}

// ── State ──────────────────────────────────────────────────
let state = {
  inputVal: "car", query: "car",
  page: 1, pageSize: 15,
  view: "grid",
  results: [], total: 0,
  loading: true, error: null,
  selectedId: null,
  modalRec: null, modalLoading: false,
};

function setState(patch) { state = { ...state, ...patch }; render(); }

// ── Data ───────────────────────────────────────────────────
async function doFetch() {
  setState({ loading: true, error: null });
  const { query, page, pageSize } = state;
  const p = new URLSearchParams({ page, page_size: pageSize });
  if (query) p.set("q", query);
  try {
    const d = await vamFetch(`${BASE}?${p}`);
    setState({ results: d.records || [], total: d.info?.record_count || 0, loading: false });
  } catch (e) {
    setState({ error: e.message, loading: false });
  }
}

async function openModal(id) {
  setState({ selectedId: id, modalRec: null, modalLoading: true });
  try {
    const d = await vamFetch(`https://api.vam.ac.uk/v2/museumobject/${id}`);
    setState({ modalRec: d.record, modalLoading: false });
  } catch {
    setState({ modalLoading: false });
  }
}

function closeModal() { setState({ selectedId: null, modalRec: null }); }

// ── Rendering helpers ──────────────────────────────────────
function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function noImgHtml() {
  return `<div class="no-img-msg">No image available</div>`;
}

function imgTag(imgId, size, title) {
  if (!imgId) return noImgHtml();
  const src = IMG_URL(imgId, size);
  return `<img src="${src}" alt="${esc(title)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'no-img-msg',textContent:'No image available'}))">`;
}

function locationSvg() {
  return `<svg width="10" height="13" viewBox="0 0 10 13" fill="currentColor"><path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 8 5 8s5-4.25 5-8c0-2.76-2.24-5-5-5zm0 6.75A1.75 1.75 0 1 1 5 3.25a1.75 1.75 0 0 1 0 3.5z"/></svg>`;
}

function renderCardGrid(r) {
  const imgId  = r._primaryImageId;
  const title  = r._primaryTitle || "Untitled";
  const maker  = r._primaryMaker?.name || "";
  const date   = r._primaryDate || "";
  const venue  = r._currentLocation?.displayName || "";
  const onDisp = r.onDisplay;

  return `
    <div class="card-grid" data-id="${r.systemNumber}">
      <div class="card-img-wrap">${imgTag(imgId, "200", title)}</div>
      <div class="card-body">
        <div class="card-title">${esc(title)}</div>
        ${maker ? `<div class="card-maker">${esc(maker)}</div>` : ""}
        ${date  ? `<div class="card-date">${esc(date)}</div>` : ""}
        ${venue ? `<div class="card-location">${locationSvg()} ${esc(venue)}</div>` : ""}
        <div class="${onDisp ? "on-display-label yes" : "not-on-display"}">${onDisp ? "On display" : "Not on display"}</div>
      </div>
    </div>`;
}

function renderCardList(r) {
  const imgId  = r._primaryImageId;
  const title  = r._primaryTitle || "Untitled";
  const maker  = r._primaryMaker?.name || "";
  const date   = r._primaryDate || "";
  const venue  = r._currentLocation?.displayName || "";
  const onDisp = r.onDisplay;

  return `
    <div class="card-list" data-id="${r.systemNumber}">
      <div class="card-list-thumb">${imgTag(imgId, "100", title)}</div>
      <div class="card-list-info">
        <div class="card-title">${esc(title)}</div>
        ${maker ? `<div class="card-maker">${esc(maker)}</div>` : ""}
        ${date  ? `<div class="card-date">${esc(date)}</div>` : ""}
        ${venue ? `<div class="card-location">${locationSvg()} ${esc(venue)}</div>` : ""}
        <div class="${onDisp ? "on-display-label yes" : "not-on-display"}">${onDisp ? "On display" : "Not on display"}</div>
      </div>
    </div>`;
}

function renderPagination() {
  const { page, total, pageSize } = state;
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return { paginationHtml: "", pageSizeHtml: "" };

  const s = new Set([1, totalPages]);
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) s.add(i);
  const pages = [...s].sort((a, b) => a - b);

  let html = `<div class="pagination">`;
  html += `<button class="btn-page" data-page="${page - 1}" ${page === 1 ? "disabled" : ""}>‹ Back</button>`;
  pages.forEach((pg, i) => {
    const prev = pages[i - 1];
    if (prev && pg - prev > 1) html += `<span class="pagination-ellipsis">…</span>`;
    html += `<button class="btn-page${pg === page ? " active" : ""}" data-page="${pg}">${String(pg).padStart(2,"0")}</button>`;
  });
  html += `<button class="btn-page" data-page="${page + 1}" ${page === totalPages ? "disabled" : ""}>Next</button>`;
  html += `</div>`;

  const pageSizeHtml = `
    <div class="page-size-row">
      Results per page:
      <span class="${pageSize === 15 ? "active" : ""}" data-size="15">15</span>
      <span class="${pageSize === 50 ? "active" : ""}" data-size="50">50</span>
    </div>`;

  return { paginationHtml: html, pageSizeHtml };
}

function renderModal() {
  const { selectedId, modalRec: r, modalLoading } = state;
  if (!selectedId) return "";

  let body;
  if (modalLoading) {
    body = `<div style="width:100%;padding:4rem;display:flex;align-items:center;justify-content:center"><div class="spinner"></div></div>`;
  } else if (!r) {
    body = `<p class="modal-error">Could not load details.</p>`;
  } else {
    const imgId = r.images?.[0]?.imageId || r.images?.[0] || "";
    const title  = r.titles?.[0]?.title || r._primaryTitle || "Untitled";
    const maker  = r.artistMakerPerson?.[0]?.name?.text || r.artistMakerOrganisations?.[0]?.name?.text || "";
    const date   = r.productionDates?.[0]?.date?.text || "";
    const type   = r.objectType || "";
    const mats   = r.materials?.map((m) => m.text).join(", ") || "";
    const place  = r.productionPlaces?.[0]?.place?.text || "";
    const desc   = r.briefDescription || "";
    const acc    = r.accessionNumber || selectedId;

    const metaRows = [["Maker", maker],["Date", date],["Place", place],["Materials", mats],["Accession", acc]]
      .filter(([,v]) => v)
      .map(([k,v]) => `<div class="modal-meta-row"><span class="modal-meta-key">${k}</span><span>${esc(v)}</span></div>`)
      .join("");

    body = `
      <div class="modal-img-panel">${imgTag(imgId, "500", title)}</div>
      <div class="modal-info-panel">
        ${type ? `<div class="modal-object-type">${esc(type)}</div>` : ""}
        <h2 class="modal-title">${esc(title)}</h2>
        <div class="modal-meta">${metaRows}</div>
        ${desc ? `<div class="modal-desc">${esc(desc)}</div>` : ""}
        <button class="more-like-this-btn" id="btn-more-like-this">Find more like this</button>
      </div>`;
  }

  return `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <button class="modal-close" id="btn-modal-close">×</button>
        ${body}
      </div>
    </div>`;
}

// ── Main render ────────────────────────────────────────────
function render() {
  const { inputVal, query, pageSize, view, results, total, loading, error } = state;

  const inp = document.getElementById("search-input");
  if (inp && document.activeElement !== inp) inp.value = inputVal;

  ["grid","list"].forEach(v => {
    const b = document.getElementById(`btn-view-${v}`);
    if (b) b.classList.toggle("active", view === v);
  });

  const countEl = document.getElementById("result-count");
  const queryEl = document.getElementById("result-query");
  if (countEl) {
    if (loading) { countEl.textContent = "Searching…"; if (queryEl) queryEl.textContent = ""; }
    else if (error) { countEl.innerHTML = `<span style="color:#c0392b;font-size:15px">Error: ${esc(error)}</span>`; }
    else { countEl.textContent = `${total.toLocaleString()} objects`; if (queryEl) queryEl.textContent = query ? `matching "${query}"` : ""; }
  }

  const resultsEl = document.getElementById("results");
  if (resultsEl) {
    if (loading) {
      resultsEl.innerHTML = `<div class="state-center"><div class="spinner"></div><p>Searching the collections…</p></div>`;
    } else if (error) {
      resultsEl.innerHTML = `<div class="state-center"><p style="color:#c0392b">Failed to load results.</p></div>`;
    } else if (!results.length) {
      resultsEl.innerHTML = `<div class="state-center"><p style="font-size:16px;margin-bottom:6px">No results found</p><p>Try a different search term.</p></div>`;
    } else {
      const cls = view === "grid" ? "results-grid" : "results-list";
      resultsEl.innerHTML = `<div class="${cls}">${results.map(r => view === "grid" ? renderCardGrid(r) : renderCardList(r)).join("")}</div>`;
    }
  }

  const { paginationHtml, pageSizeHtml } = loading ? { paginationHtml: "", pageSizeHtml: "" } : renderPagination();
  const pagEl = document.getElementById("pagination");
  const psEl  = document.getElementById("page-size-row");
  if (pagEl) pagEl.innerHTML = paginationHtml;
  if (psEl)  psEl.innerHTML  = pageSizeHtml || "";

  const modalRoot = document.getElementById("modal-root");
  if (modalRoot) modalRoot.innerHTML = renderModal();

  attachDelegatedEvents();
}

// ── Delegated events (re-attached after each render) ───────
function attachDelegatedEvents() {
  document.querySelectorAll("[data-id]").forEach(el => {
    el.addEventListener("click", () => openModal(el.dataset.id));
  });

  document.querySelectorAll("[data-page]").forEach(btn => {
    if (!btn.disabled) btn.addEventListener("click", () => {
      setState({ page: Number(btn.dataset.page) });
      doFetch();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.querySelectorAll("[data-size]").forEach(el => {
    el.addEventListener("click", () => {
      setState({ pageSize: Number(el.dataset.size), page: 1 });
      doFetch();
    });
  });

  const backdrop = document.getElementById("modal-backdrop");
  if (backdrop) backdrop.addEventListener("click", e => { if (e.target === backdrop) closeModal(); });

  const closeBtn = document.getElementById("btn-modal-close");
  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  const moreLikeBtn = document.getElementById("btn-more-like-this");
  if (moreLikeBtn) moreLikeBtn.addEventListener("click", runMoreLikeThis);
}

// ── Static event listeners (once on load) ─────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("search-input").addEventListener("keydown", e => {
    if (e.key === "Enter") { setState({ query: e.target.value, page: 1 }); doFetch(); }
  });
  document.getElementById("search-input").addEventListener("input", e => {
    state = { ...state, inputVal: e.target.value };
  });
  document.getElementById("btn-search-go").addEventListener("click", () => {
    setState({ query: state.inputVal, page: 1 }); doFetch();
  });

  render();
  doFetch();
  initVoice();
});

// ── Voice helpers ──────────────────────────────────────────
const synonyms = {
  "doll": "dolls", "toy": "toys", "bike": "bicycle", "bicycle": "bicycles",
  "dress": "fashion", "clothes": "fashion", "clothing": "fashion", "hat": "hats",
  "gun": "firearms", "sword": "swords", "knife": "knives", "weapon": "weapons",
  "clock": "timepieces", "watch": "watches", "timepiece": "timepieces",
  "ring": "jewellery", "necklace": "jewellery", "jewel": "jewellery", "jewelry": "jewellery",
  "phone": "telephones", "telephone": "telephones",
  "chair": "furniture", "table": "furniture", "sofa": "furniture",
  "pot": "ceramics", "vase": "ceramics", "bowl": "ceramics", "cup": "ceramics",
  "painting": "paintings", "drawing": "drawings", "print": "prints",
  "photo": "photographs", "photograph": "photographs", "picture": "photographs",
  "book": "books", "map": "maps", "poster": "posters",
  "shoe": "shoes", "boot": "boots", "bag": "bags",
  "lamp": "lighting", "light": "lighting", "candle": "candlesticks",
  "coin": "coins", "medal": "medals", "stamp": "stamps",
  "ship": "ships", "boat": "boats", "plane": "aircraft", "airplane": "aircraft",
  "train": "railways", "railway": "railways",
  "god": "religion", "church": "religion", "cross": "religion",
};

function setVoiceStatus(message) {
  const statusEl = document.getElementById("voice-status");
  if (statusEl) statusEl.textContent = message;
}

function runVoiceSearch(term) {
  const cleanTerm = (term || "").trim();
  if (!cleanTerm) { setVoiceStatus("Didn't catch that."); return; }

  const searchTerm = synonyms[cleanTerm.toLowerCase()] || cleanTerm;

  const input = document.getElementById("search-input");
  if (input) input.value = searchTerm;

  setVoiceStatus(`Searching for: "${searchTerm}"`);
  setState({ inputVal: searchTerm, query: searchTerm, page: 1 });
  doFetch();
}

function runMoreLikeThis() {
  const { modalRec } = state;
  if (!modalRec) { setVoiceStatus("No item is open."); return; }

  const type = modalRec.objectType || "";
  const category = modalRec.categories?.[0]?.text || "";
  const searchTerm = type || category;

  if (!searchTerm) { setVoiceStatus("Couldn't find a category for this item."); return; }

  closeModal();
  setVoiceStatus(`Finding more: "${searchTerm}"`);
  const input = document.getElementById("search-input");
  if (input) input.value = searchTerm;
  setState({ inputVal: searchTerm, query: searchTerm, page: 1 });
  doFetch();
}

function initVoice() {
  const micBtn = document.getElementById("btn-mic");
  const interactBtn = document.getElementById("btn-voice-interact");

  if (!window.annyang) {
    if (micBtn) { micBtn.disabled = true; }
    if (interactBtn) { interactBtn.disabled = true; }
    setVoiceStatus("Voice search unavailable.");
    return;
  }

  annyang.removeCommands();
  annyang.addCommands({
    // ── Search ──────────────────────────────────────
    "search for *term":       runVoiceSearch,
    "find *term":             runVoiceSearch,
    "show me *term":          runVoiceSearch,
    "look for *term":         runVoiceSearch,

    // ── Navigation ──────────────────────────────────
    "next page": () => {
      const { page, total, pageSize } = state;
      const totalPages = Math.ceil(total / pageSize);
      if (page < totalPages) {
        setState({ page: page + 1 });
        doFetch();
        window.scrollTo({ top: 0, behavior: "smooth" });
        setVoiceStatus("Next page.");
      } else {
        setVoiceStatus("Already on the last page.");
      }
    },
    "previous page": () => {
      if (state.page > 1) {
        setState({ page: state.page - 1 });
        doFetch();
        window.scrollTo({ top: 0, behavior: "smooth" });
        setVoiceStatus("Previous page.");
      } else {
        setVoiceStatus("Already on the first page.");
      }
    },
    "go back": () => {
      if (state.page > 1) {
        setState({ page: state.page - 1 });
        doFetch();
        window.scrollTo({ top: 0, behavior: "smooth" });
        setVoiceStatus("Previous page.");
      } else {
        setVoiceStatus("Already on the first page.");
      }
    },
    "first page": () => {
      setState({ page: 1 });
      doFetch();
      window.scrollTo({ top: 0, behavior: "smooth" });
      setVoiceStatus("First page.");
    },

    // ── View ────────────────────────────────────────
    "grid view":  () => { setState({ view: "grid" }); setVoiceStatus("Grid view."); },
    "list view":  () => { setState({ view: "list" }); setVoiceStatus("List view."); },
    "show grid":  () => { setState({ view: "grid" }); setVoiceStatus("Grid view."); },
    "show list":  () => { setState({ view: "list" }); setVoiceStatus("List view."); },

    // ── Scroll ──────────────────────────────────────
    "scroll down": () => { window.scrollBy({ top: 400, behavior: "smooth" }); setVoiceStatus("Scrolling down."); },
    "scroll up":   () => { window.scrollBy({ top: -400, behavior: "smooth" }); setVoiceStatus("Scrolling up."); },
    "go to top":   () => { window.scrollTo({ top: 0, behavior: "smooth" }); setVoiceStatus("Going to top."); },
    "go to bottom":() => { window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); setVoiceStatus("Going to bottom."); },

    // ── Modal ───────────────────────────────────────
    "close":              closeModal,
    "close modal":        closeModal,
    "go back":            closeModal,
    "more like this":         runMoreLikeThis,
    "show me more like this": runMoreLikeThis,

    // ── Open results by number ───────────────────────
    "open first result":  () => openResultByIndex(0),
    "open second result": () => openResultByIndex(1),
    "open third result":  () => openResultByIndex(2),
    "open fourth result": () => openResultByIndex(3),
    "open fifth result":  () => openResultByIndex(4),
    "open result one":    () => openResultByIndex(0),
    "open result two":    () => openResultByIndex(1),
    "open result three":  () => openResultByIndex(2),
    "open result four":   () => openResultByIndex(3),
    "open result five":   () => openResultByIndex(4),

    // ── Page size ────────────────────────────────────
    "show fifteen results": () => { setState({ pageSize: 15, page: 1 }); doFetch(); setVoiceStatus("Showing 15 results."); },
    "show fifty results":   () => { setState({ pageSize: 50, page: 1 }); doFetch(); setVoiceStatus("Showing 50 results."); },

    // ── Fallback ─────────────────────────────────────
    "*term": runVoiceSearch,
  });

  const startListening = () => {
    setVoiceStatus("Listening…");
    annyang.start({ autoRestart: false, continuous: false });
  };

  annyang.addCallback("start", () => {
    if (micBtn) micBtn.classList.add("is-listening");
    if (interactBtn) interactBtn.classList.add("is-listening");
    setVoiceStatus("Listening…");
  });

  annyang.addCallback("end", () => {
    if (micBtn) micBtn.classList.remove("is-listening");
    if (interactBtn) interactBtn.classList.remove("is-listening");
    setTimeout(() => {
      const status = document.getElementById("voice-status")?.textContent;
      if (status && !status.includes("Searching") && !status.includes("page") && !status.includes("view") && !status.includes("Finding")) {
        setVoiceStatus("Done. Click to speak again.");
      }
    }, 500);
  });

  annyang.addCallback("error", () => {
    if (micBtn) micBtn.classList.remove("is-listening");
    if (interactBtn) interactBtn.classList.remove("is-listening");
    setVoiceStatus("Mic error. Check browser permission.");
  });

  annyang.addCallback("resultNoMatch", () => {
    if (micBtn) micBtn.classList.remove("is-listening");
    if (interactBtn) interactBtn.classList.remove("is-listening");
    setVoiceStatus("Didn't catch that. Try again.");
  });

  if (micBtn) micBtn.addEventListener("click", startListening);
  if (interactBtn) interactBtn.addEventListener("click", startListening);
};
function openResultByIndex(index) {
  const { results } = state;
  if (!results.length) { setVoiceStatus("No results to open."); return; }
  if (index >= results.length) { setVoiceStatus(`Only ${results.length} results visible.`); return; }
  openModal(results[index].systemNumber);
  setVoiceStatus(`Opening result ${index + 1}.`);
}