const BASE_URL = "https://api.vam.ac.uk/v2/objects/search";

const makeImgUrl = (id, width) =>
  `https://framemark.vam.ac.uk/collections/${id}/full/${width},/0/default.jpg`;

// fetch helper
async function getData(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`V&A API error (${res.status})`);
  }

  return res.json();
}

let state = {
  inputVal: "car",
  query: "car",

  page: 1,
  pageSize: 15,
  view: "grid",

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

  recommendationMode: false,
  recommendationText: "",
};

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

// regular search
async function loadResults() {
  setState({
    loading: true,
    error: null,
    recommendationMode: false,
    recommendationText: "",
  });

  const params = new URLSearchParams({
    page: state.page,
    page_size: state.pageSize,
  });

  if (state.query) {
    params.set("q", state.query);
  }

  try {
    const data = await getData(`${BASE_URL}?${params}`);

    setState({
      results: data.records || [],
      total: data.info?.record_count || 0,
      loading: false,
    });
  } catch (err) {
    setState({
      error: err.message,
      loading: false,
    });
  }
}

// recommendations
async function getRecommendations() {
  setState({
    loading: true,
    error: null,
    recommendationMode: true,
    recommendationText: "Recommended for you",
    page: 1,
    selectedId: null,
    modalData: null,
    modalLoading: false,
  });

  const currentQuery = (state.query || "").toLowerCase().trim();
  let terms = ["fashion", "ceramics", "photographs", "furniture"];

  if (currentQuery.includes("car")) {
    terms = ["cars", "transport", "toy", "posters"];
  } else if (
    currentQuery.includes("dress") ||
    currentQuery.includes("fashion") ||
    currentQuery.includes("clothes")
  ) {
    terms = ["fashion", "textiles", "jewellery", "shoes"];
  } else if (
    currentQuery.includes("ring") ||
    currentQuery.includes("necklace") ||
    currentQuery.includes("jewel")
  ) {
    terms = ["jewellery", "gold", "silver", "metalwork"];
  } else if (
    currentQuery.includes("chair") ||
    currentQuery.includes("table") ||
    currentQuery.includes("sofa")
  ) {
    terms = ["furniture", "lighting", "interior", "ceramics"];
  } else if (
    currentQuery.includes("photo") ||
    currentQuery.includes("picture") ||
    currentQuery.includes("photograph")
  ) {
    terms = ["photographs", "prints", "drawings", "posters"];
  } else if (!currentQuery) {
    terms = ["fashion", "sculpture", "glass", "textiles"];
  }

  try {
    const everything = [];

    for (const term of terms) {
      const params = new URLSearchParams({
        q: term,
        page_size: 4,
      });

      const data = await getData(`${BASE_URL}?${params}`);
      everything.push(...(data.records || []));
    }

    const seen = new Set();
    const cleaned = everything.filter((item) => {
      if (!item?.systemNumber) return false;
      if (seen.has(item.systemNumber)) return false;
      seen.add(item.systemNumber);
      return true;
    });

    setState({
      results: cleaned.slice(0, 12),
      total: cleaned.slice(0, 12).length,
      loading: false,
    });

    setVoiceStatus("Got some recommendations.");
  } catch (err) {
    setState({
      error: err.message,
      loading: false,
    });

    setVoiceStatus("Couldn't get recommendations.");
  }
}

// open item modal
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
    const data = await getData(`https://api.vam.ac.uk/v2/museumobject/${id}`);

    setState({
      modalData: data.record,
      modalLoading: false,
    });
  } catch (err) {
    setState({
      modalLoading: false,
      similarLoading: false,
    });
  }
}

function closeModal() {
  setState({
    selectedId: null,
    modalData: null,
    showSimilarItems: false,
  });

  document.body.style.overflow = "";
}

// similar stuff for modal
async function getSimilarStuff(modalData) {
  if (!modalData) {
    setState({ similarLoading: false });
    return;
  }

  const type = modalData.objectType || "";
  const category = modalData.categories?.[0]?.text || "";
  const searchTerm = type || category;

  if (!searchTerm) {
    setState({ similarLoading: false });
    return;
  }

  try {
    const params = new URLSearchParams({
      q: searchTerm,
      page_size: 4,
    });

    const data = await getData(`${BASE_URL}?${params}`);

    setState({
      similarItems: (data.records || []).slice(0, 4),
      similarLoading: false,
    });
  } catch (err) {
    setState({ similarLoading: false });
  }
}

// just basic escaping
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

function makeImg(imgId, size, title) {
  if (!imgId) return noImageHTML();

  return `
    <img
      src="${makeImgUrl(imgId, size)}"
      alt="${escapeHTML(title)}"
      onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'no-img-msg',textContent:'No image available'}))"
    >
  `;
}

function locationIcon() {
  return `
    <svg width="10" height="13" viewBox="0 0 10 13" fill="currentColor">
      <path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 8 5 8s5-4.25 5-8c0-2.76-2.24-5-5-5zm0 6.75A1.75 1.75 0 1 1 5 3.25a1.75 1.75 0 0 1 0 3.5z"/>
    </svg>
  `;
}

function renderSimilarCard(item) {
  const imgId = item._primaryImageId;
  const title = item._primaryTitle || "Untitled";

  return `
    <div class="similar-card" data-id="${item.systemNumber}" title="${escapeHTML(title)}">
      <div class="similar-card-img">
        ${makeImg(imgId, "100", title)}
      </div>
      <div class="similar-card-title">
        ${escapeHTML(title.length > 30 ? title.slice(0, 27) + "..." : title)}
      </div>
    </div>
  `;
}

function makeGridCard(item) {
  const imgId = item._primaryImageId;
  const title = item._primaryTitle || "Untitled";
  const makerName = item._primaryMaker?.name || "";
  const date = item._primaryDate || "";
  const place = item._currentLocation?.displayName || "";
  const onDisplay = item.onDisplay;

  return `
    <div class="card-grid" data-id="${item.systemNumber}">
      <div class="card-img-wrap">
        ${makeImg(imgId, "200", title)}
      </div>

      <div class="card-body">
        <div class="card-title">${escapeHTML(title)}</div>

        ${makerName ? `<div class="card-maker">${escapeHTML(makerName)}</div>` : ""}
        ${date ? `<div class="card-date">${escapeHTML(date)}</div>` : ""}
        ${place ? `<div class="card-location">${locationIcon()} ${escapeHTML(place)}</div>` : ""}

        <div class="${onDisplay ? "on-display-label yes" : "not-on-display"}">
          ${onDisplay ? "On display" : "Not on display"}
        </div>
      </div>
    </div>
  `;
}

function makeListCard(item) {
  const imgId = item._primaryImageId;
  const title = item._primaryTitle || "Untitled";
  const makerName = item._primaryMaker?.name || "";
  const date = item._primaryDate || "";
  const place = item._currentLocation?.displayName || "";
  const onDisplay = item.onDisplay;

  return `
    <div class="card-list" data-id="${item.systemNumber}">
      <div class="card-list-thumb">
        ${makeImg(imgId, "100", title)}
      </div>

      <div class="card-list-info">
        <div class="card-title">${escapeHTML(title)}</div>

        ${makerName ? `<div class="card-maker">${escapeHTML(makerName)}</div>` : ""}
        ${date ? `<div class="card-date">${escapeHTML(date)}</div>` : ""}
        ${place ? `<div class="card-location">${locationIcon()} ${escapeHTML(place)}</div>` : ""}

        <div class="${onDisplay ? "on-display-label yes" : "not-on-display"}">
          ${onDisplay ? "On display" : "Not on display"}
        </div>
      </div>
    </div>
  `;
}

function renderPagination() {
  const { page, total, pageSize, recommendationMode } = state;
  const totalPages = Math.ceil(total / pageSize);

  if (recommendationMode || totalPages <= 1) {
    return {
      paginationHtml: "",
      pageSizeHtml: recommendationMode
        ? `<div class="page-size-row">Showing curated picks</div>`
        : "",
    };
  }

  const pageSet = new Set([1, totalPages]);

  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
    pageSet.add(i);
  }

  const pages = [...pageSet].sort((a, b) => a - b);

  let html = `<div class="pagination">`;

  html += `
    <button class="btn-page" data-page="${page - 1}" ${page === 1 ? "disabled" : ""}>
      ‹ Back
    </button>
  `;

  pages.forEach((pg, i) => {
    const prev = pages[i - 1];

    if (prev && pg - prev > 1) {
      html += `<span class="pagination-ellipsis">…</span>`;
    }

    html += `
      <button class="btn-page${pg === page ? " active" : ""}" data-page="${pg}">
        ${String(pg).padStart(2, "0")}
      </button>
    `;
  });

  html += `
    <button class="btn-page" data-page="${page + 1}" ${page === totalPages ? "disabled" : ""}>
      Next
    </button>
  `;

  html += `</div>`;

  const pageSizeHtml = `
    <div class="page-size-row">
      Results per page:
      <span class="${pageSize === 15 ? "active" : ""}" data-size="15">15</span>
      <span class="${pageSize === 50 ? "active" : ""}" data-size="50">50</span>
    </div>
  `;

  return { paginationHtml: html, pageSizeHtml };
}

function renderModal() {
  const {
    selectedId,
    modalData,
    modalLoading,
    similarItems,
    similarLoading,
    showSimilarItems,
  } = state;

  if (!selectedId) return "";

  let body = "";

  if (modalLoading) {
    body = `
      <div style="width:100%;padding:4rem;display:flex;align-items:center;justify-content:center">
        <div class="spinner"></div>
      </div>
    `;
  } else if (!modalData) {
    body = `<p class="modal-error">Could not load details.</p>`;
  } else {
    const imgId = modalData.images?.[0]?.imageId || modalData.images?.[0] || "";
    const title = modalData.titles?.[0]?.title || modalData._primaryTitle || "Untitled";
    const maker =
      modalData.artistMakerPerson?.[0]?.name?.text ||
      modalData.artistMakerOrganisations?.[0]?.name?.text ||
      "";
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
      .filter(([, value]) => value)
      .map(
        ([label, value]) => `
          <div class="modal-meta-row">
            <span class="modal-meta-key">${label}</span>
            <span>${escapeHTML(value)}</span>
          </div>
        `
      )
      .join("");

    const similarHtml = showSimilarItems
      ? similarLoading
        ? `<div class="similar-section"><p>Loading similar items...</p></div>`
        : similarItems.length
        ? `
          <div class="similar-section">
            <h3>More like this</h3>
            <div class="similar-items-grid">
              ${similarItems.map(renderSimilarCard).join("")}
            </div>
          </div>
        `
        : ""
      : "";

    body = `
      <div class="modal-img-panel">
        ${makeImg(imgId, "500", title)}
      </div>

      <div class="modal-info-panel">
        ${type ? `<div class="modal-object-type">${escapeHTML(type)}</div>` : ""}
        <h2 class="modal-title">${escapeHTML(title)}</h2>
        <div class="modal-meta">${rows}</div>
        ${desc ? `<div class="modal-desc">${escapeHTML(desc)}</div>` : ""}
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

function render() {
  const {
    inputVal,
    query,
    view,
    results,
    total,
    loading,
    error,
    selectedId,
    recommendationMode,
    recommendationText,
  } = state;

  const input = document.getElementById("search-input");
  if (input && document.activeElement !== input) {
    input.value = inputVal;
  }

  ["grid", "list"].forEach((mode) => {
    const btn = document.getElementById(`btn-view-${mode}`);
    if (btn) btn.classList.toggle("active", view === mode);
  });

  const countEl = document.getElementById("result-count");
  const queryEl = document.getElementById("result-query");

  if (countEl) {
    if (loading) {
      countEl.textContent = "Searching...";
      if (queryEl) queryEl.textContent = "";
    } else if (error) {
      countEl.innerHTML = `<span style="color:#c0392b;font-size:15px">Error: ${escapeHTML(error)}</span>`;
      if (queryEl) queryEl.textContent = "";
    } else if (recommendationMode) {
      countEl.textContent = recommendationText || "Recommended for you";
      if (queryEl) queryEl.textContent = `${results.length} picks`;
    } else {
      countEl.textContent = `${total.toLocaleString()} objects`;
      if (queryEl) queryEl.textContent = query ? `matching "${query}"` : "";
    }
  }

  const resultsEl = document.getElementById("results");

  if (resultsEl) {
    if (loading) {
      resultsEl.innerHTML = `
        <div class="state-center">
          <div class="spinner"></div>
          <p>Searching the collection...</p>
        </div>
      `;
    } else if (error) {
      resultsEl.innerHTML = `
        <div class="state-center">
          <p style="color:#c0392b">Something went wrong loading the results.</p>
        </div>
      `;
    } else if (!results.length) {
      resultsEl.innerHTML = `
        <div class="state-center">
          <p style="font-size:16px;margin-bottom:6px">No results found</p>
          <p>Try searching for something else.</p>
        </div>
      `;
    } else {
      const wrapperClass = view === "grid" ? "results-grid" : "results-list";

      resultsEl.innerHTML = `
        <div class="${wrapperClass}">
          ${results.map((item) => (view === "grid" ? makeGridCard(item) : makeListCard(item))).join("")}
        </div>
      `;
    }
  }

  const { paginationHtml, pageSizeHtml } = loading
    ? { paginationHtml: "", pageSizeHtml: "" }
    : renderPagination();

  const paginationEl = document.getElementById("pagination");
  const pageSizeEl = document.getElementById("page-size-row");

  if (paginationEl) paginationEl.innerHTML = paginationHtml;
  if (pageSizeEl) pageSizeEl.innerHTML = pageSizeHtml || "";

  const modalRoot = document.getElementById("modal-root");
  if (modalRoot) {
    modalRoot.innerHTML = renderModal();

    if (selectedId) {
      document.body.style.overflow = "hidden";
    }
  }

  attachEventsAgain();
}

// innerHTML kills listeners so we add them back
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

  document.querySelectorAll("[data-size]").forEach((el) => {
    el.addEventListener("click", () => {
      setState({
        pageSize: Number(el.dataset.size),
        page: 1,
      });
      loadResults();
    });
  });

  const backdrop = document.getElementById("modal-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
  }

  const closeBtn = document.getElementById("btn-modal-close");
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
}

document.addEventListener("DOMContentLoaded", () => {
  showIntroPopup();

  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("btn-search-go");

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      setState({
        query: e.target.value,
        page: 1,
      });
      loadResults();
    }
  });

  searchInput.addEventListener("input", (e) => {
    state = {
      ...state,
      inputVal: e.target.value,
    };
  });

  searchBtn.addEventListener("click", () => {
    setState({
      query: state.inputVal,
      page: 1,
    });
    loadResults();
  });

  render();
  loadResults();
  initVoice();
});

const synonyms = {
  doll: "dolls",
  toy: "toys",
  bike: "bicycle",
  bicycle: "bicycles",
  dress: "fashion",
  clothes: "fashion",
  clothing: "fashion",
  hat: "hats",
  gun: "firearms",
  sword: "swords",
  knife: "knives",
  weapon: "weapons",
  clock: "timepieces",
  watch: "watches",
  timepiece: "timepieces",
  ring: "jewellery",
  necklace: "jewellery",
  jewel: "jewellery",
  jewelry: "jewellery",
  phone: "telephones",
  telephone: "telephones",
  chair: "furniture",
  table: "furniture",
  sofa: "furniture",
  pot: "ceramics",
  vase: "ceramics",
  bowl: "ceramics",
  cup: "ceramics",
  painting: "paintings",
  drawing: "drawings",
  print: "prints",
  photo: "photographs",
  photograph: "photographs",
  picture: "photographs",
  book: "books",
  map: "maps",
  poster: "posters",
  shoe: "shoes",
  boot: "boots",
  bag: "bags",
  lamp: "lighting",
  light: "lighting",
  candle: "candlesticks",
  coin: "coins",
  medal: "medals",
  stamp: "stamps",
  ship: "ships",
  boat: "boats",
  plane: "aircraft",
  airplane: "aircraft",
  train: "railways",
  railway: "railways",
  god: "religion",
  church: "religion",
  cross: "religion",
};

function setVoiceStatus(message) {
  const statusEl = document.getElementById("voice-status");
  if (statusEl) statusEl.textContent = message;
}

function runVoiceSearch(term) {
  const clean = (term || "").trim().toLowerCase();

  if (!clean) {
    setVoiceStatus("Didn't catch that.");
    return;
  }

  const searchTerm = synonyms[clean] || term;
  const input = document.getElementById("search-input");

  if (input) input.value = searchTerm;

  setVoiceStatus(`Searching for "${searchTerm}"`);

  setState({
    inputVal: searchTerm,
    query: searchTerm,
    page: 1,
  });

  loadResults();
}

function runRecommendations() {
  const input = document.getElementById("search-input");
  if (input) input.value = "";

  setVoiceStatus("Getting recommendations.");
  getRecommendations();
}

function runMoreLikeThis() {
  const { modalData } = state;

  if (!modalData) {
    setVoiceStatus("No item is open.");
    return;
  }

  const type = modalData.objectType || "";
  const category = modalData.categories?.[0]?.text || "";
  const searchTerm = type || category;

  if (!searchTerm) {
    setVoiceStatus("Couldn't find similar stuff.");
    return;
  }

  setVoiceStatus(`Finding more like "${searchTerm}"`);
  setState({
    showSimilarItems: true,
    similarLoading: true,
  });

  getSimilarStuff(modalData);
}

function showIntroPopup() {
  const html = `
    <div class="welcome-modal-backdrop" id="welcome-backdrop">
      <div class="welcome-modal">
        <h1>Welcome to V&A Collections Explorer</h1>

        <h2>How to use it:</h2>
        <ul>
          <li><strong>Search:</strong> Type or say "search for [item]"</li>
          <li><strong>Voice:</strong> Click the button to use voice commands</li>
          <li><strong>Views:</strong> Switch between grid and list view</li>
          <li><strong>Details:</strong> Click an item to open the modal</li>
          <li><strong>Recommendations:</strong> Say "give me recommendations"</li>
        </ul>

        <h2>Voice commands:</h2>
        <ul>
          <li><strong>Scroll:</strong> "scroll down", "scroll up", "go to top", "go to bottom"</li>
          <li><strong>Pages:</strong> "next page", "previous page", "first page"</li>
          <li><strong>Views:</strong> "grid view", "list view"</li>
          <li><strong>Results:</strong> "open first result", "open second result"</li>
          <li><strong>Modal:</strong> "close", "more like this"</li>
          <li><strong>Recommendations:</strong> "give me recommendations", "surprise me"</li>
        </ul>

        <button class="welcome-modal-close" id="btn-welcome-close">Get Started</button>
      </div>
    </div>
  `;

  const root = document.getElementById("welcome-modal-root");

  if (root) {
    root.innerHTML = html;

    document.getElementById("btn-welcome-close")?.addEventListener("click", () => {
      root.innerHTML = "";
    });

    document.getElementById("welcome-backdrop")?.addEventListener("click", (e) => {
      if (e.target.id === "welcome-backdrop") {
        root.innerHTML = "";
      }
    });
  }
}

function openResultByIndex(index) {
  if (!state.results.length) {
    setVoiceStatus("No results to open.");
    return;
  }

  if (index >= state.results.length) {
    setVoiceStatus(`Only ${state.results.length} results showing.`);
    return;
  }

  openModal(state.results[index].systemNumber);
  setVoiceStatus(`Opening result ${index + 1}`);
}

function initVoice() {
  const micBtn = document.getElementById("btn-mic");
  const interactBtn = document.getElementById("btn-voice-interact");

  if (!window.annyang) {
    if (micBtn) micBtn.disabled = true;
    if (interactBtn) interactBtn.disabled = true;
    setVoiceStatus("Voice search unavailable.");
    return;
  }

  annyang.removeCommands();

  const commands = {
    "give me recommendations": runRecommendations,
    "show recommendations": runRecommendations,
    "recommend something": runRecommendations,
    "surprise me": runRecommendations,
    "what do you recommend": runRecommendations,

    "scroll page down": () => {
      window.scrollBy({ top: 400, behavior: "smooth" });
      setVoiceStatus("Scrolling page down.");
    },

    "scroll page up": () => {
      window.scrollBy({ top: -400, behavior: "smooth" });
      setVoiceStatus("Scrolling page up.");
    },

    "scroll down": () => {
      if (state.selectedId) {
        const modal = document.querySelector(".modal");
        if (modal) {
          modal.scrollBy({ top: 400, behavior: "smooth" });
          setVoiceStatus("Scrolling modal down.");
        }
      } else {
        window.scrollBy({ top: 400, behavior: "smooth" });
        setVoiceStatus("Scrolling down.");
      }
    },

    "scroll up": () => {
      if (state.selectedId) {
        const modal = document.querySelector(".modal");
        if (modal) {
          modal.scrollBy({ top: -400, behavior: "smooth" });
          setVoiceStatus("Scrolling modal up.");
        }
      } else {
        window.scrollBy({ top: -400, behavior: "smooth" });
        setVoiceStatus("Scrolling up.");
      }
    },

    "scroll :direction": (direction) => {
      const isDown = direction.toLowerCase().includes("down");
      const amount = isDown ? 400 : -400;

      if (state.selectedId) {
        const modal = document.querySelector(".modal");
        if (modal) {
          modal.scrollBy({ top: amount, behavior: "smooth" });
          setVoiceStatus(isDown ? "Scrolling modal down." : "Scrolling modal up.");
        }
      } else {
        window.scrollBy({ top: amount, behavior: "smooth" });
        setVoiceStatus(isDown ? "Scrolling down." : "Scrolling up.");
      }
    },

    "go to top": () => {
      if (state.selectedId) {
        const modal = document.querySelector(".modal");
        if (modal) {
          modal.scrollTo({ top: 0, behavior: "smooth" });
          setVoiceStatus("Going to top of modal.");
        }
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
        setVoiceStatus("Going to top.");
      }
    },

    "go to bottom": () => {
      if (state.selectedId) {
        const modal = document.querySelector(".modal");
        if (modal) {
          modal.scrollTo({ top: modal.scrollHeight, behavior: "smooth" });
          setVoiceStatus("Going to bottom of modal.");
        }
      } else {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        setVoiceStatus("Going to bottom.");
      }
    },

    "next page": () => {
      if (state.recommendationMode) {
        setVoiceStatus("No pages for recommendations.");
        return;
      }

      const totalPages = Math.ceil(state.total / state.pageSize);

      if (state.page < totalPages) {
        setState({ page: state.page + 1 });
        loadResults();
        window.scrollTo({ top: 0, behavior: "smooth" });
        setVoiceStatus("Next page.");
      } else {
        setVoiceStatus("Already on the last page.");
      }
    },

    "previous page": () => {
      if (state.recommendationMode) {
        setVoiceStatus("No pages for recommendations.");
        return;
      }

      if (state.page > 1) {
        setState({ page: state.page - 1 });
        loadResults();
        window.scrollTo({ top: 0, behavior: "smooth" });
        setVoiceStatus("Previous page.");
      } else {
        setVoiceStatus("Already on the first page.");
      }
    },

    "first page": () => {
      if (state.recommendationMode) {
        setVoiceStatus("No pages for recommendations.");
        return;
      }

      setState({ page: 1 });
      loadResults();
      window.scrollTo({ top: 0, behavior: "smooth" });
      setVoiceStatus("Back to page one.");
    },

    "go back": () => {
      if (state.selectedId) {
        closeModal();
        setVoiceStatus("Closed.");
      } else if (state.recommendationMode) {
        setVoiceStatus("Try searching for something.");
      } else if (state.page > 1) {
        setState({ page: state.page - 1 });
        loadResults();
        window.scrollTo({ top: 0, behavior: "smooth" });
        setVoiceStatus("Previous page.");
      } else {
        setVoiceStatus("Already on the first page.");
      }
    },

    "grid view": () => {
      setState({ view: "grid" });
      setVoiceStatus("Grid view.");
    },

    "list view": () => {
      setState({ view: "list" });
      setVoiceStatus("List view.");
    },

    "show grid": () => {
      setState({ view: "grid" });
      setVoiceStatus("Grid view.");
    },

    "show list": () => {
      setState({ view: "list" });
      setVoiceStatus("List view.");
    },

    close: closeModal,
    "close modal": closeModal,

    more: () => {
      if (state.selectedId) runMoreLikeThis();
    },

    "more like this": runMoreLikeThis,
    "show me more like this": runMoreLikeThis,
    "show me more": runMoreLikeThis,

    "open first result": () => openResultByIndex(0),
    "open second result": () => openResultByIndex(1),
    "open third result": () => openResultByIndex(2),
    "open fourth result": () => openResultByIndex(3),
    "open fifth result": () => openResultByIndex(4),

    "open result one": () => openResultByIndex(0),
    "open result two": () => openResultByIndex(1),
    "open result three": () => openResultByIndex(2),
    "open result four": () => openResultByIndex(3),
    "open result five": () => openResultByIndex(4),

    "show fifteen results": () => {
      setState({
        pageSize: 15,
        page: 1,
      });
      loadResults();
      setVoiceStatus("Showing 15 results.");
    },

    "show fifty results": () => {
      setState({
        pageSize: 50,
        page: 1,
      });
      loadResults();
      setVoiceStatus("Showing 50 results.");
    },

    "search for *term": runVoiceSearch,
    "find *term": runVoiceSearch,
    "look for *term": runVoiceSearch,
    "search *term": runVoiceSearch,
  };

  annyang.addCommands(commands);

  let isListening = false;

  const startListening = () => {
    if (isListening) {
      annyang.abort();
      isListening = false;

      if (micBtn) micBtn.classList.remove("is-listening");
      if (interactBtn) interactBtn.classList.remove("is-listening");

      setVoiceStatus("Voice off.");
      return;
    }

    isListening = true;

    if (micBtn) micBtn.classList.add("is-listening");
    if (interactBtn) interactBtn.classList.add("is-listening");

    setVoiceStatus("Listening...");
    annyang.start({ autoRestart: true, continuous: true });
  };

  annyang.addCallback("start", () => {
    if (micBtn) micBtn.classList.add("is-listening");
    if (interactBtn) interactBtn.classList.add("is-listening");
    setVoiceStatus("Listening...");
  });

  annyang.addCallback("end", () => {
    if (micBtn) micBtn.classList.remove("is-listening");
    if (interactBtn) interactBtn.classList.remove("is-listening");

    setTimeout(() => {
      const status = document.getElementById("voice-status")?.textContent;

      if (
        status &&
        !status.includes("Searching") &&
        !status.includes("page") &&
        !status.includes("view") &&
        !status.includes("Finding") &&
        !status.includes("recommend")
      ) {
        setVoiceStatus("Done. Click to speak again.");
      }
    }, 500);

    if (isListening) {
      setTimeout(() => annyang.start({ autoRestart: true, continuous: true }), 300);
    }
  });

  annyang.addCallback("error", () => {
    if (micBtn) micBtn.classList.remove("is-listening");
    if (interactBtn) interactBtn.classList.remove("is-listening");
    setVoiceStatus("Mic error. Check browser permission.");
  });

  annyang.addCallback("resultNoMatch", () => {
    setVoiceStatus("Didn't catch that, still listening...");
  });

  if (micBtn) micBtn.addEventListener("click", startListening);
  if (interactBtn) interactBtn.addEventListener("click", startListening);
}