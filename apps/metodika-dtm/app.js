/**
 * DTM ČR – Metodický a technický portál DI a TI
 * Barevný motiv Deep Blue & Tech Orange
 * Spojovníkový strom, dynamické Členění kapitoly v pravém panelu a bohaté podklady
 */

document.addEventListener("DOMContentLoaded", () => {
  const data = window.DTM_DATA;
  if (!data) {
    console.error("Chyba: Databáze DTM_DATA nebyla nalezena.");
    return;
  }

  // Stav aplikace
  const state = {
    currentRoute: "overview", // ID tématu nebo nástroje
    activeModuleTab: "all",    // "all", "plain", "rules", "schema", "legal"
    searchQuery: "",
    viewMode: localStorage.getItem("dtm_view_mode") || "summary", // "summary" nebo "detailed"
    theme: localStorage.getItem("dtm_theme") || "light",
    activeDiagram: "diagram-crossroad",
    quizIndex: 0,
    quizScore: 0,
    quizAnswered: false
  };

  // =========================================================================
  // KNIHOVNA ČISTÝCH VEKTOROVÝCH SVG IKON (100% náhrada emoji v celém webu)
  // =========================================================================
  const SVG_ICONS = {
    sun: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    moon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    zap: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    lightbulb: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4.95 11.95A3 3 0 0 1 9 16h6a3 3 0 0 1 1.95-2.05A7 7 0 0 0 12 2z"/></svg>`,
    clipboard: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 12l2 2 4-4"/></svg>`,
    drafting: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 21 21 21 3 3 3 21"/><circle cx="8" cy="16" r="1.5"/></svg>`,
    scales: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><polyline points="2 7 12 3 22 7"/><path d="M6 16l-4-9 8 0-4 9a3 3 0 0 1-6 0z"/><path d="M18 16l-4-9 8 0-4 9a3 3 0 0 1-6 0z"/><path d="M5 21h14"/></svg>`,
    document: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    car: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="7" rx="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M5 11l2-5h10l2 5"/></svg>`,
    bolt: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    layers: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    chart: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    book: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    alertTriangle: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    crossCircle: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    checkCircle: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11.5 14.5 16 9"/></svg>`,
    checkShield: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`,
    code: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    info: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    external: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>`
  };

  // =========================================================================
  // JEDNOTNÝ MECHANISMUS PRO CALLOUTY / ALERTY
  // =========================================================================
  function renderCallout({ type, title, titleExtra = "", contentHtml, id = "" }) {
    const icons = {
      alert: SVG_ICONS.alertTriangle,
      tip: SVG_ICONS.lightbulb,
      recommendation: SVG_ICONS.checkShield,
      schema: SVG_ICONS.drafting,
      code: SVG_ICONS.code,
      info: SVG_ICONS.info
    };
    const icon = icons[type] || SVG_ICONS.info;
    const idAttr = id ? ` id="${id}"` : "";
    return `
      <aside class="callout callout--${type}"${idAttr} role="region" aria-label="${title}">
        <div class="callout-head">
          <span class="callout-icon" aria-hidden="true">${icon}</span>
          <span class="callout-label">${title}</span>
          ${titleExtra ? `<span class="callout-title-extra">${titleExtra}</span>` : ""}
        </div>
        <div class="callout-body">
          ${contentHtml}
        </div>
      </aside>
    `;
  }

  // DOM Reference
  const mainContent = document.getElementById("app-content");
  const breadcrumbsNav = document.getElementById("breadcrumbs-nav");
  const currentCrumb = document.getElementById("current-crumb");
  const currentCodeTag = document.getElementById("current-code-tag");
  const globalSearchInput = document.getElementById("global-search");
  const themeToggleBtn = document.getElementById("theme-toggle");
  const themeIcon = document.getElementById("theme-icon");
  const viewModeToggleBtn = document.getElementById("view-mode-toggle");
  const viewModeIcon = document.getElementById("view-mode-icon");
  const viewModeText = document.getElementById("view-mode-text");
  const sidebarToggleBtn = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("app-sidebar");

  const treeListDi = document.getElementById("tree-list-di");
  const treeListTi = document.getElementById("tree-list-ti");
  const treeListMeta = document.getElementById("tree-list-meta");

  // Pravý panel reference
  const railHeading = document.getElementById("rail-heading");
  const railToc = document.getElementById("rail-toc");

  // =========================================================================
  // 1. TÉMA A REŽIM ZOBRAZENÍ
  // =========================================================================
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (themeIcon) {
      themeIcon.innerHTML = theme === "dark" ? SVG_ICONS.sun : SVG_ICONS.moon;
    }
    localStorage.setItem("dtm_theme", theme);
  }
  applyTheme(state.theme);

  themeToggleBtn.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme(state.theme);
  });

  function updateViewModeUI() {
    viewModeText.textContent = state.viewMode === "summary" ? "Stručně" : "Detailně";
    if (viewModeIcon) {
      viewModeIcon.innerHTML = SVG_ICONS.zap;
    }
    localStorage.setItem("dtm_view_mode", state.viewMode);
  }
  updateViewModeUI();

  viewModeToggleBtn.addEventListener("click", () => {
    state.viewMode = state.viewMode === "summary" ? "detailed" : "summary";
    updateViewModeUI();
    renderCurrentRoute();
  });

  // Mobilní menu toggle
  sidebarToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar.classList.toggle("open");
  });

  // Zavření mobilního sidebaru kliknutím mimo něj
  document.addEventListener("click", (e) => {
    if (sidebar.classList.contains("open") && !sidebar.contains(e.target) && !sidebarToggleBtn.contains(e.target)) {
      sidebar.classList.remove("open");
    }
  });

  // Klávesová zkratka Ctrl+K / Cmd+K pro hledání
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      globalSearchInput.focus();
      globalSearchInput.select();
    }
    if (e.key === "Escape" && document.activeElement === globalSearchInput) {
      globalSearchInput.value = "";
      state.searchQuery = "";
      globalSearchInput.blur();
      renderCurrentRoute();
    }
  });

  globalSearchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    if (state.searchQuery.length > 0 && state.currentRoute !== "overview") {
      navigateTo("overview", false);
    } else {
      renderCurrentRoute();
    }
  });

  // =========================================================================
  // 2. SPOJOVNÍKOVÝ NAVIGAČNÍ STROM (Tree Structure dle screenshotu)
  // =========================================================================
  function buildSidebarTree() {
    function renderTreeItems(items) {
      return items.map(t => `
        <li class="tree-child-node">
          <a class="sidebar-link" data-route="${t.id}" title="${t.title}">
            <span class="tree-item-icon" aria-hidden="true">
              <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4">
                <polygon points="7 1.5 12.5 4.5 7 7.5 1.5 4.5"/>
                <polygon points="7 6.5 12.5 9.5 7 12.5 1.5 9.5"/>
              </svg>
            </span>
            <span class="tree-label">${t.shortTitle}</span>
            <span class="link-code">${t.code}</span>
          </a>
        </li>
      `).join("");
    }

    // DI Sekce
    const diTopics = data.topics.filter(t => t.category === "DI");
    treeListDi.innerHTML = renderTreeItems(diTopics);

    // TI Sekce
    const tiTopics = data.topics.filter(t => t.category === "TI");
    treeListTi.innerHTML = renderTreeItems(tiTopics);

    // Společná metodika Sekce
    const metaTopics = data.topics.filter(t => t.category === "METODIKA");
    treeListMeta.innerHTML = renderTreeItems(metaTopics);

    // Navigační handlery pro položky stromu
    document.querySelectorAll(".sidebar-link").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const route = link.dataset.route;
        sidebar.classList.remove("open");
        navigateTo(route);
      });
    });

    // Tlačítka pro sbalení / rozbalení větví stromu (šipka ▼ / ▶)
    document.querySelectorAll(".tree-expander").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const parentNode = btn.closest(".tree-root-node");
        if (parentNode) {
          parentNode.classList.toggle("is-collapsed");
        }
      });
    });

    // Kliknutí na hlavičky kapitol ve stromu (např. "1. Dopravní infrastruktura") scrolluje v přehledu
    document.querySelectorAll(".tree-group-title[data-cat-filter]").forEach(titleEl => {
      titleEl.addEventListener("click", () => {
        const cat = titleEl.dataset.catFilter.toLowerCase();
        navigateTo("overview");
        setTimeout(() => {
          const targetSection = document.getElementById(`cat-sec-${cat}`);
          if (targetSection) {
            targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 50);
      });
    });
  }

  // =========================================================================
  // 3. SMĚROVÁNÍ (ROUTING) A DROBEČKY (BREADCRUMBS)
  // =========================================================================
  function navigateTo(routeId, updateHash = true) {
    state.currentRoute = routeId;
    if (updateHash) {
      window.location.hash = routeId;
    }

    // Reset záložky na výchozí "all" (Zobrazit vše)
    state.activeModuleTab = "all";

    // Aktualizovat aktivní položku ve stromu a zajistit rozbalení rodičovské větve
    document.querySelectorAll(".sidebar-link").forEach(link => {
      const isActive = link.dataset.route === routeId;
      link.classList.toggle("active", isActive);
      if (isActive) {
        const parentGroup = link.closest(".tree-root-node");
        if (parentGroup && parentGroup.classList.contains("is-collapsed")) {
          parentGroup.classList.remove("is-collapsed");
        }
      }
    });

    // Aktualizovat drobečky
    updateBreadcrumbs(routeId);

    // Vykreslit obsah
    renderCurrentRoute();

    // Aktualizovat dynamický pravý panel (ČLENĚNÍ KAPITOLY)
    updateRightRail(routeId);

    // Posunout nahoru
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateBreadcrumbs(routeId) {
    if (routeId === "overview") {
      breadcrumbsNav.innerHTML = `
        <a class="crumb-link" href="../../index.html" title="Zpět na rozcestník Atomicon GIS">Dashboard</a>
        <span class="crumb-separator">›</span>
        <a class="crumb-link" data-target="overview">DTM Metodika</a>
        <span class="crumb-separator">›</span>
        <span class="crumb-current">Přehled všech kapitol</span>
      `;
      currentCodeTag.textContent = "PORTAL-ROOT";
      bindCrumbEvents();
      return;
    }

    const topic = data.topics.find(t => t.id === routeId);
    if (topic) {
      breadcrumbsNav.innerHTML = `
        <a class="crumb-link" href="../../index.html" title="Zpět na rozcestník Atomicon GIS">Dashboard</a>
        <span class="crumb-separator">›</span>
        <a class="crumb-link" data-target="overview">DTM Metodika</a>
        <span class="crumb-separator">›</span>
        <span class="crumb-link" data-target="cat-${topic.category.toLowerCase()}">${topic.categoryName}</span>
        <span class="crumb-separator">›</span>
        <span class="crumb-current">${topic.shortTitle}</span>
      `;
      currentCodeTag.textContent = topic.code;
      bindCrumbEvents();
      return;
    }

    const toolNames = {
      "tool-diagrams": { name: "Technická CAD schémata", code: "CAD-SVG" },
      "tool-cheatsheet": { name: "Třídy přesnosti (1–9) & Slovník", code: "ACC-TAB" },
      "tool-mistakes": { name: "Katalog častých chyb", code: "ERR-CAT" },
      "tool-decision": { name: "Rádce: Co dělat když...", code: "HOW-TO" },
      "tool-quiz": { name: "Znalostní test DTM", code: "DTM-TEST" }
    };

    if (toolNames[routeId]) {
      breadcrumbsNav.innerHTML = `
        <a class="crumb-link" href="../../index.html" title="Zpět na rozcestník Atomicon GIS">Dashboard</a>
        <span class="crumb-separator">›</span>
        <a class="crumb-link" data-target="overview">DTM Metodika</a>
        <span class="crumb-separator">›</span>
        <span class="crumb-current">${toolNames[routeId].name}</span>
      `;
      currentCodeTag.textContent = toolNames[routeId].code;
      bindCrumbEvents();
    }
  }

  function bindCrumbEvents() {
    breadcrumbsNav.querySelectorAll(".crumb-link").forEach(link => {
      link.addEventListener("click", () => {
        const target = link.dataset.target;
        if (target === "overview") {
          navigateTo("overview");
        } else if (target && target.startsWith("cat-")) {
          navigateTo("overview");
          const cat = target.replace("cat-", "").toLowerCase();
          setTimeout(() => {
            const targetSec = document.getElementById(`cat-sec-${cat}`);
            if (targetSec) targetSec.scrollIntoView({ behavior: "smooth" });
          }, 50);
        }
      });
    });
  }

  // Reakce na změnu hashe v URL
  window.addEventListener("hashchange", () => {
    const rawHash = window.location.hash.replace("#", "") || "overview";
    // Ignorovat, pokud hash začíná interní kotvou (mod- nebo cat-sec-)
    if (rawHash.startsWith("mod-") || rawHash.startsWith("cat-sec-")) {
      return;
    }
    if (rawHash !== state.currentRoute) {
      navigateTo(rawHash, false);
    }
  });

  function normalizeStr(str) {
    if (!str) return "";
    return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function highlightText(text, query) {
    if (!query || !text) return text;
    try {
      const qClean = query.trim();
      if (!qClean) return text;
      const accentMap = {
        'a': '[aá]', 'c': '[cč]', 'd': '[dď]', 'e': '[eéě]', 'i': '[ií]',
        'n': '[nň]', 'o': '[oó]', 'r': '[rř]', 's': '[sš]', 't': '[tť]',
        'u': '[uúů]', 'y': '[yý]', 'z': '[zž]'
      };
      let pattern = "";
      for (const char of qClean.toLowerCase()) {
        const escaped = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        pattern += accentMap[char] || escaped;
      }
      const regex = new RegExp(`(${pattern})`, 'gi');
      return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    } catch {
      return text;
    }
  }

  // =========================================================================
  // 4. DYNAMICKÝ PRAVÝ PANEL (Členění kapitoly & Kotvy)
  // Řeší přesně problém: "v pravém panelu ČLENĚNÍ KAPITOLY nefunguje žádná kapitola"
  // =========================================================================
  function updateRightRail(routeId) {
    if (!railHeading || !railToc) return;

    // A) Prohlížíme konkrétní téma
    const topic = data.topics.find(t => t.id === routeId);
    if (topic) {
      railHeading.textContent = `Členění: ${topic.shortTitle}`;
      const hasSchema = topic.svgDiagram && diagrams[topic.svgDiagram];

      railToc.innerHTML = `
        <li><a class="rail-nav-link" data-scroll="mod-plain">${SVG_ICONS.lightbulb}<span>1. Praktický výklad</span></a></li>
        <li><a class="rail-nav-link" data-scroll="mod-rules">${SVG_ICONS.clipboard}<span>2. Technická pravidla (${topic.keyRules.length})</span></a></li>
        ${hasSchema ? `<li><a class="rail-nav-link" data-scroll="mod-schema">${SVG_ICONS.drafting}<span>3. Vektorové CAD schéma</span></a></li>` : ''}
        <li><a class="rail-nav-link" data-scroll="mod-legal">${SVG_ICONS.scales}<span>4. Právní rámec & JVF</span></a></li>
        <li><a class="rail-nav-link" href="${topic.dtmWikiUrl}" target="_blank" rel="noopener">${SVG_ICONS.external}<span>Oficiální zdroj DTMwiki</span></a></li>
      `;
      bindRailScrollEvents(topic);
      return;
    }

    // B) Prohlížíme Rozcestník (Overview)
    if (routeId === "overview") {
      railHeading.textContent = "Katalog rozcestníku";
      railToc.innerHTML = `
        <li><a class="rail-nav-link" data-scroll="cat-sec-di">${SVG_ICONS.car}<span>1. Dopravní infrastruktura</span></a></li>
        <li><a class="rail-nav-link" data-scroll="cat-sec-ti">${SVG_ICONS.bolt}<span>2. Technická infrastruktura</span></a></li>
        <li><a class="rail-nav-link" data-scroll="cat-sec-meta">${SVG_ICONS.layers}<span>3. Společná metodika & JVF</span></a></li>
      `;
      bindRailScrollEvents();
      return;
    }

    // C) Nástroje
    if (routeId === "tool-diagrams") {
      railHeading.textContent = "Seznam CAD schémat";
      railToc.innerHTML = Object.keys(diagrams).map(k => `
        <li><a class="rail-nav-link" data-select-diag="${k}">${SVG_ICONS.drafting}<span>${diagrams[k].tabTitle}</span></a></li>
      `).join("");
      railToc.querySelectorAll("[data-select-diag]").forEach(link => {
        link.addEventListener("click", () => {
          state.activeDiagram = link.dataset.selectDiag;
          renderDiagramsPage();
        });
      });
      return;
    }

    if (routeId === "tool-cheatsheet") {
      railHeading.textContent = "Obsah přehledu";
      railToc.innerHTML = `
        <li><a class="rail-nav-link" data-scroll="sec-accuracy-table">${SVG_ICONS.chart}<span>Třídy přesnosti (1–9)</span></a></li>
        <li><a class="rail-nav-link" data-scroll="sec-glossary-list">${SVG_ICONS.book}<span>Slovník pojmů a zkratek</span></a></li>
      `;
      bindRailScrollEvents();
      return;
    }

    if (routeId === "tool-mistakes") {
      railHeading.textContent = "Katalog chyb";
      railToc.innerHTML = `
        <li><a class="rail-nav-link" data-scroll="sec-mistakes-title">${SVG_ICONS.alertTriangle}<span>Přehled 6 kritických chyb</span></a></li>
      `;
      bindRailScrollEvents();
      return;
    }

    // Ostatní nástroje
    railHeading.textContent = "Členění sekce";
    railToc.innerHTML = `
      <li><a class="rail-nav-link" data-scroll="sec-tool-content">${SVG_ICONS.document}<span>Hlavní obsah nástroje</span></a></li>
    `;
    bindRailScrollEvents();
  }

  function bindRailScrollEvents(topic) {
    railToc.querySelectorAll("[data-scroll]").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const targetId = link.dataset.scroll;

        // Pokud jsme v detailu tématu a uživatel měl přepnuto na konkrétní záložku,
        // přepnout na "all", aby byl cílový element zaručeně v DOMu!
        if (topic && state.activeModuleTab !== "all") {
          state.activeModuleTab = "all";
          renderTopicPage(topic);
        }

        setTimeout(() => {
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
            // Vizuální záblesk (Flash highlight) pro okamžité potvrzení prokliku
            targetEl.classList.remove("section-flash-active");
            void targetEl.offsetWidth; // trigger reflow
            targetEl.classList.add("section-flash-active");
          }
        }, 30);
      });
    });
  }

  // =========================================================================
  // 5. VYKRESLOVÁNÍ STRÁNEK
  // =========================================================================
  function renderCurrentRoute() {
    const route = state.currentRoute;

    // Je to téma?
    const topic = data.topics.find(t => t.id === route);
    if (topic) {
      renderTopicPage(topic);
      return;
    }

    // Nástroje
    if (route === "tool-diagrams") {
      renderDiagramsPage();
      return;
    }
    if (route === "tool-cheatsheet") {
      renderCheatSheetPage();
      return;
    }
    if (route === "tool-mistakes") {
      renderMistakesPage();
      return;
    }
    if (route === "tool-decision") {
      renderDecisionPage();
      return;
    }
    if (route === "tool-quiz") {
      renderQuizPage();
      return;
    }

    // Výchozí: Přehledový katalog (Overview)
    renderOverviewPage();
  }

  // -------------------------------------------------------------------------
  // POHLED: MODULÁRNÍ DETAIL TÉMATU
  // -------------------------------------------------------------------------
  function renderTopicPage(topic) {
    const isDi = topic.category === "DI";
    const isTi = topic.category === "TI";
    const catClass = isDi ? "cat-di" : (isTi ? "cat-ti" : "cat-meta");

    const displayedRules = state.viewMode === "summary" 
      ? topic.keyRules.slice(0, 4) 
      : topic.keyRules;

    const rulesHtml = displayedRules.map((r, i) => `
      <div class="rule-card">
        <span class="rule-idx">${i + 1}</span>
        <div class="rule-content">${r}</div>
      </div>
    `).join("");

    const hasSchema = topic.svgDiagram && diagrams[topic.svgDiagram];
    const activeTab = state.activeModuleTab;

    // 1. Modul: Praktické vysvětlení (Jednotný Callout Tip & Info)
    const plainModuleHtml = `
      ${renderCallout({
        type: "tip",
        title: "Praktické vysvětlení v lidské řeči",
        titleExtra: "(Podstata v terénu)",
        contentHtml: topic.plainExplain,
        id: "mod-plain"
      })}
      ${renderCallout({
        type: "info",
        title: "Metodické shrnutí MPS DTM",
        contentHtml: `<p>${topic.summary}</p>`
      })}
    `;

    // 2. Modul: Technická pravidla
    const rulesModuleHtml = `
      <div style="margin-bottom: 20px;" id="mod-rules">
        <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px;">
          <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            ${SVG_ICONS.clipboard}
            <span>Závazná a doporučená pravidla MPS DTM:</span>
          </h3>
          <span style="font-size: 0.74rem; color: var(--text-muted); font-family: var(--font-mono);">${displayedRules.length} pravidel</span>
        </div>
        ${rulesHtml}
      </div>
    `;

    // 3. Modul: Technické CAD schéma (Jednotný Callout Schema)
    const schemaModuleHtml = hasSchema ? renderCallout({
      type: "schema",
      title: "Technické CAD schéma",
      titleExtra: diagrams[topic.svgDiagram].title,
      id: "mod-schema",
      contentHtml: `
        <div class="cad-viewport">
          ${diagrams[topic.svgDiagram].render()}
        </div>
        <div class="cad-desc">
          ${diagrams[topic.svgDiagram].desc}
        </div>
      `
    }) : '';

    // 4. Modul: Vyhláška, Paragrafy a Zdroje (Jednotný Callout Code)
    const legalInfo = topic.legalInfo || {
      act: topic.standardRef || "Vyhláška č. 393/2020 Sb. o DTM kraje • Zákon č. 200/1994 Sb.",
      paragraphs: "Závazná metodická stanoviska Metodické pracovní skupiny DTM (MPS DTM) zřízené pod gescí Českého úřadu zeměměřického a katastrálního (ČÚZK).",
      jvfElement: "Datová sada JVF DTM dle verze 1.4.3 / 1.5.x",
      attributes: "Poloha X, Y (S-JTSK), Výška Z (Bpv), LEVEL (-1, 0, 1), Třída přesnosti 1–9"
    };

    const legalModuleHtml = renderCallout({
      type: "code",
      title: "Právní a datový rámec",
      titleExtra: "(Vyhláška č. 393/2020 Sb. & Datová sada JVF DTM)",
      id: "mod-legal",
      contentHtml: `
        <div class="legal-grid">
          <div class="legal-item">
            <span class="legal-item-label">Příslušný zákon a vyhláška:</span>
            <div class="legal-item-value"><strong>${legalInfo.act}</strong></div>
          </div>
          <div class="legal-item">
            <span class="legal-item-label">Konkrétní ustanovení / Paragrafy:</span>
            <div class="legal-item-value">${legalInfo.paragraphs}</div>
          </div>
          <div class="legal-item">
            <span class="legal-item-label">Datový prvek v JVF DTM:</span>
            <div class="legal-item-value" style="font-family: var(--font-mono); color: var(--brand-blue);">${legalInfo.jvfElement}</div>
          </div>
          <div class="legal-item">
            <span class="legal-item-label">Předepsané atributy a přesnost:</span>
            <div class="legal-item-value" style="font-family: var(--font-mono);">${legalInfo.attributes}</div>
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--chrome-crumb-border);">
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${topic.tags.map(t => `<span class="crumb-tag" style="cursor: pointer;" data-tag="${t}">${t}</span>`).join("")}
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="https://app.iprpraha.cz/apl/app/slovnik-dtm/" target="_blank" rel="noopener noreferrer" class="crumb-tag" style="text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
              <span>Slovník datového modelu DTM</span>
              ${SVG_ICONS.external}
            </a>
            <a href="${topic.dtmWikiUrl}" target="_blank" rel="noopener noreferrer" class="btn-source-cuzk">
              <span>Otevřít kapitolu na DTMwiki ČÚZK</span>
              ${SVG_ICONS.external}
            </a>
          </div>
        </div>
      `
    });

    // Sestavení aktivního těla podle zvolené záložky
    let contentBody = "";
    if (activeTab === "all") {
      contentBody = plainModuleHtml + rulesModuleHtml + schemaModuleHtml + legalModuleHtml;
    } else if (activeTab === "plain") {
      contentBody = plainModuleHtml;
    } else if (activeTab === "rules") {
      contentBody = rulesModuleHtml;
    } else if (activeTab === "schema") {
      contentBody = schemaModuleHtml || "<p style='color: var(--text-muted); padding: 20px;'>Toto téma nemá samostatné vektorové schéma.</p>";
    } else if (activeTab === "legal") {
      contentBody = legalModuleHtml;
    }

    mainContent.innerHTML = `
      <article class="topic-page">
        <!-- Hero hlavička kapitoly -->
        <header class="topic-hero">
          <div class="topic-meta-row">
            <span class="badge-topic-code">${topic.code}</span>
            <span class="badge-topic-cat ${catClass}">${topic.categoryName}</span>
          </div>
          <h1 class="topic-main-title">${topic.title}</h1>
          <div class="topic-standard-cite">${topic.standardRef}</div>
        </header>

        <!-- Navigační záložky modulu kapitoly (Styl gisadmin) -->
        <nav class="topic-module-nav" aria-label="Záložky kapitoly">
          <button class="module-tab-btn ${activeTab === 'all' ? 'active' : ''}" data-mod="all">Zobrazit vše</button>
          <button class="module-tab-btn ${activeTab === 'plain' ? 'active' : ''}" data-mod="plain">Praktický výklad</button>
          <button class="module-tab-btn ${activeTab === 'rules' ? 'active' : ''}" data-mod="rules">Technická pravidla</button>
          ${hasSchema ? `<button class="module-tab-btn ${activeTab === 'schema' ? 'active' : ''}" data-mod="schema">Výkres / Schéma</button>` : ''}
          <button class="module-tab-btn ${activeTab === 'legal' ? 'active' : ''}" data-mod="legal">Vyhláška & Zdroj</button>
        </nav>

        <!-- Vykreslený obsah -->
        <div class="topic-module-body">
          ${contentBody}
        </div>
      </article>
    `;

    // Handlery pro záložky
    mainContent.querySelectorAll(".module-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        state.activeModuleTab = btn.dataset.mod;
        renderTopicPage(topic);
      });
    });

    // Handlery pro štítky
    mainContent.querySelectorAll("[data-tag]").forEach(tagEl => {
      tagEl.addEventListener("click", () => {
        state.searchQuery = tagEl.dataset.tag.toLowerCase();
        globalSearchInput.value = tagEl.dataset.tag;
        navigateTo("overview");
      });
    });
  }

  // -------------------------------------------------------------------------
  // POHLED: PŘEHLEDNÝ A VÝRAZNĚ ODLIŠENÝ KATALOG (Overview)
  // -------------------------------------------------------------------------
  function renderOverviewPage() {
    const q = state.searchQuery;

    function filterList(list) {
      if (!q) return list;
      const qNorm = normalizeStr(q);
      return list.filter(item => {
        const inTitle = normalizeStr(item.title).includes(qNorm);
        const inPlain = normalizeStr(item.plainExplain).includes(qNorm);
        const inSummary = normalizeStr(item.summary).includes(qNorm);
        const inCode = normalizeStr(item.code).includes(qNorm);
        const inTags = item.tags && item.tags.some(t => normalizeStr(t).includes(qNorm));
        const inRules = item.keyRules && item.keyRules.some(r => normalizeStr(r).includes(qNorm));
        return inTitle || inPlain || inSummary || inCode || inTags || inRules;
      });
    }

    const diList = filterList(data.topics.filter(t => t.category === "DI"));
    const tiList = filterList(data.topics.filter(t => t.category === "TI"));
    const metaList = filterList(data.topics.filter(t => t.category === "METODIKA"));

    function renderCategorySection(title, catId, badgeText, list) {
      if (list.length === 0) return "";
      const cards = list.map(item => `
        <div class="catalog-item-card" data-route="${item.id}">
          <div class="catalog-item-top">
            <span class="badge-topic-code">${item.code}</span>
            <span class="crumb-tag" style="font-size: 0.65rem;">${item.tags[0] || 'METODIKA'}</span>
          </div>
          <h3 class="catalog-item-title">${highlightText(item.title, q)}</h3>
          <p class="catalog-item-summary">${highlightText(item.summary, q)}</p>
          <div class="catalog-item-bottom">
            <span style="font-family: var(--font-mono); color: var(--text-muted);">${item.tags.slice(0, 2).join(" • ")}</span>
            <span class="catalog-item-link">Číst výklad →</span>
          </div>
        </div>
      `).join("");

      return `
        <section class="catalog-section" id="cat-sec-${catId}">
          <div class="catalog-section-head">
            <h2>${title}</h2>
            <span>${list.length} kapitol</span>
          </div>
          <div class="catalog-grid">
            ${cards}
          </div>
        </section>
      `;
    }

    const diHtml = renderCategorySection("1. Dopravní infrastruktura (DI)", "di", "DI", diList);
    const tiHtml = renderCategorySection("2. Technická infrastruktura (TI)", "ti", "TI", tiList);
    const metaHtml = renderCategorySection("3. Společná metodika a standardy JVF", "meta", "STD", metaList);

    const hasAnyResults = (diList.length + tiList.length + metaList.length) > 0;

    mainContent.innerHTML = `
      <div style="margin-bottom: 22px; border-bottom: 2px solid var(--chrome-crumb-border); padding-bottom: 14px;">
        <h1 style="font-size: 1.55rem; font-weight: 800; color: var(--text-primary); margin-bottom: 6px;">Katalog metodických kapitol DTM ČR</h1>
        <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5;">Vyberte kapitolu v levém navigačním stromu nebo níže v katalogu. Všechna témata obsahují srozumitelný lidský výklad, technická pravidla i přesné právní citace.</p>
        ${q ? `<p style="margin-top: 8px; font-weight: 700; color: var(--brand-orange); font-size: 0.88rem;">Filtrováno výrazem: "${q}"</p>` : ''}
      </div>

      ${hasAnyResults ? (diHtml + tiHtml + metaHtml) : `
        <div style="padding: 30px; text-align: center; background: var(--content-app-bg); border: 2px dashed var(--chrome-sidebar-border); border-radius: var(--radius-sm);">
          <p style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">Nenalezeny žádné záznamy</p>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Výraz "${q}" neodpovídá žádné kapitole. Zkuste hledat např. OPK, most, sloupy nebo kanalizace.</p>
          <button id="reset-search-btn" class="btn-source-cuzk" style="margin-top: 10px; font-size: 0.75rem; padding: 4px 10px;">Zrušit vyhledávání</button>
        </div>
      `}
    `;

    // Handlery pro klik na karty
    mainContent.querySelectorAll(".catalog-item-card").forEach(card => {
      card.addEventListener("click", () => {
        navigateTo(card.dataset.route);
      });
    });

    document.getElementById("reset-search-btn")?.addEventListener("click", () => {
      globalSearchInput.value = "";
      state.searchQuery = "";
      renderOverviewPage();
    });
  }

  // -------------------------------------------------------------------------
  // POHLED: SCHÉMATA (CAD / SVG)
  // -------------------------------------------------------------------------
  function renderDiagramsPage() {
    const diag = diagrams[state.activeDiagram] || diagrams["diagram-crossroad"];

    const navButtons = Object.keys(diagrams).map(key => `
      <button class="module-tab-btn ${state.activeDiagram === key ? 'active' : ''}" data-diag="${key}">
        ${diagrams[key].tabTitle}
      </button>
    `).join("");

    mainContent.innerHTML = `
      <div style="margin-bottom: 20px; padding-bottom: 0;">
        <h1 style="font-size: 1.55rem; font-weight: 800; color: var(--text-primary); margin-bottom: 6px;">Technická CAD schémata DTM</h1>
        <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5;">Přesné vektorové nákresy geometrických pravidel, výškových úrovní LEVEL a stavebních součástí.</p>
        
        <nav class="topic-module-nav" style="margin-top: 16px; margin-bottom: 0;">
          ${navButtons}
        </nav>
      </div>

      <div class="callout-human" style="background: var(--content-app-bg); border-left-color: var(--brand-blue); padding: 16px;">
        <h2 style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">${diag.title}</h2>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 12px;">${diag.desc}</p>

        <div style="background: var(--content-bg); border: 2px solid var(--chrome-crumb-border); border-radius: 4px; padding: 12px; margin-bottom: 12px; max-width: 720px; display: flex; justify-content: center;">
          ${diag.render()}
        </div>

        <div style="background: var(--content-bg); border: 1px solid var(--chrome-crumb-border); border-radius: 4px; padding: 10px 14px; font-size: 0.82rem; max-width: 720px;">
          <strong style="display: block; font-size: 0.72rem; text-transform: uppercase; color: var(--brand-blue); letter-spacing: 0.5px; margin-bottom: 4px;">Technická legenda k výkresu:</strong>
          <div>${diag.legend}</div>
        </div>
      </div>
    `;

    mainContent.querySelectorAll("[data-diag]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.activeDiagram = btn.dataset.diag;
        renderDiagramsPage();
        updateRightRail("tool-diagrams");
      });
    });
  }

  // -------------------------------------------------------------------------
  // POHLED: TŘÍDY PŘESNOSTI A SLOVNÍK
  // -------------------------------------------------------------------------
  function renderCheatSheetPage() {
    const rows = data.accuracyClasses.map(ac => `
      <tr>
        <td><span class="crumb-tag">${ac.code}</span></td>
        <td style="font-weight: 800; color: var(--brand-blue);">Třída ${ac.classNum}</td>
        <td style="font-family: var(--font-mono); font-weight: 700; color: var(--brand-orange);">${ac.mxy}</td>
        <td style="font-family: var(--font-mono); color: var(--text-muted);">${ac.mz}</td>
        <td style="font-size: 0.82rem; line-height: 1.35;">${ac.usage}</td>
      </tr>
    `).join("");

    const glossary = data.glossary.map(g => `
      <div class="legal-item">
        <div style="display: flex; align-items: baseline; gap: 6px; margin-bottom: 2px;">
          <strong style="color: var(--brand-blue); font-family: var(--font-mono); font-size: 0.88rem;">${g.term}</strong>
          <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted);">${g.full}</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.35;">${g.desc}</p>
      </div>
    `).join("");

    mainContent.innerHTML = `
      <div style="margin-bottom: 16px; border-bottom: 2px solid var(--chrome-crumb-border); padding-bottom: 10px;">
        <h1 style="font-size: 1.45rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">Třídy přesnosti v DTM & Slovník pojmů</h1>
        <p style="color: var(--text-secondary); font-size: 0.88rem;">Závazné mezní souřadnicové odchylky dle Přílohy č. 2 vyhlášky č. 393/2020 Sb.</p>
      </div>

      ${renderCallout({
        type: 'alert',
        title: 'Kritické pravidlo přesnosti pro geodety a správce sítí',
        titleExtra: 'Vyhláška 393/2020 Sb. Příloha 2',
        contentHtml: '<p>Třídy 1 až 3 vyžadují výhradně přímé geodetické zaměření v terénu ověřené oprávněným zeměměřickým inženýrem (ÚOZI/AZI). Třídy 4 až 9 jsou určeny pro digitalizaci z historické papírové dokumentace nebo přibližné zákresy – nesmí být použity při přejímce nové stavby do provozu!</p>'
      })}

      <div class="tech-table-box" id="sec-accuracy-table" style="margin-top: 14px;">
        <table class="tech-table">
          <thead>
            <tr>
              <th>Kód</th>
              <th>Třída přesnosti</th>
              <th>Polohová odchylka (m_xy)</th>
              <th>Výšková odchylka (m_z)</th>
              <th>Předepsané použití v praxi</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      <div style="margin: 24px 0 10px; border-bottom: 2px solid var(--chrome-crumb-border); padding-bottom: 6px;" id="sec-glossary-list">
        <h2 style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">Slovník zkratek a legislativních pojmů</h2>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
        ${glossary}
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // POHLED: ČASTÉ CHYBY (ŠPATNĚ VS SPRÁVNĚ)
  // -------------------------------------------------------------------------
  function renderMistakesPage() {
    const listHtml = data.commonMistakes.map(m => `
      <div class="mistake-box" style="margin-bottom: 16px;">
        <div class="mistake-bar" style="margin-bottom: 8px;">
          <span class="crumb-tag">${m.code}</span>
          <span class="badge-topic-cat ${m.category === 'DI' ? 'cat-di' : (m.category === 'TI' ? 'cat-ti' : 'cat-meta')}">${m.category}</span>
          <span style="color: var(--callout-alert-title); font-size: 0.76rem; font-weight: 700;">Dopad: ${m.impact}</span>
        </div>
        <div class="mistake-cols" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
          ${renderCallout({
            type: 'alert',
            title: 'Chybný postup v praxi',
            titleExtra: m.code,
            contentHtml: `<p style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.45;">${m.bad}</p>`
          })}
          ${renderCallout({
            type: 'recommendation',
            title: 'Správné řešení dle MPS DTM',
            titleExtra: 'Požadovaný stav',
            contentHtml: `<p style="font-size: 0.85rem; color: var(--text-primary); font-weight: 600; line-height: 1.45;">${m.good}</p>`
          })}
        </div>
      </div>
    `).join("");

    mainContent.innerHTML = `
      <div style="margin-bottom: 16px; border-bottom: 2px solid var(--chrome-crumb-border); padding-bottom: 10px;" id="sec-mistakes-title">
        <h1 style="font-size: 1.45rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">Časté chyby z praxe (Špatně vs. Správně)</h1>
        <p style="color: var(--text-secondary); font-size: 0.88rem;">Přehled chyb, které vedou k zamítnutí dat krajským editorem nebo k topologickým kolizím v IS DMVS.</p>
      </div>

      <div>
        ${listHtml}
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // POHLED: RÁDCE "CO DĚLAT KDYŽ..."
  // -------------------------------------------------------------------------
  function renderDecisionPage() {
    const items = data.decisionGuide.map(d => `
      <div class="accordion-item" data-id="${d.id}">
        <button class="accordion-trigger">
          <span style="display: inline-flex; align-items: center; gap: 8px;">
            <span style="color: var(--brand-orange); display: flex; align-items: center;">${SVG_ICONS.lightbulb}</span>
            <span>${d.question}</span>
          </span>
          <span class="crumb-tag">${d.tag}</span>
        </button>
        <div class="accordion-body">
          ${renderCallout({
            type: 'recommendation',
            title: 'Doporučený metodický postup',
            titleExtra: d.tag,
            contentHtml: d.solution.map(s => `<p style="margin-bottom: 6px; font-size: 0.86rem; line-height: 1.45;">${s}</p>`).join("")
          })}
        </div>
      </div>
    `).join("");

    mainContent.innerHTML = `
      <div style="margin-bottom: 16px; border-bottom: 2px solid var(--chrome-crumb-border); padding-bottom: 10px;" id="sec-tool-content">
        <h1 style="font-size: 1.45rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">Metodický rádce: Co mám udělat, když...</h1>
        <p style="color: var(--text-secondary); font-size: 0.88rem;">Konkrétní doporučené postupy pro reálné modelové situace geodetů, správců sítí i starostů obcí.</p>
      </div>

      <div>
        ${items}
      </div>
    `;

    mainContent.querySelectorAll(".accordion-trigger").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = btn.parentElement;
        item.classList.toggle("active");
      });
    });
  }

  // -------------------------------------------------------------------------
  // POHLED: ZNALOSTNÍ KVÍZ
  // -------------------------------------------------------------------------
  function renderQuizPage() {
    const q = data.quiz[state.quizIndex];
    if (!q) {
      mainContent.innerHTML = `
        <div style="margin-bottom: 16px; border-bottom: 2px solid var(--chrome-crumb-border); padding-bottom: 10px;">
          <h1 style="font-size: 1.45rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">Znalostní test DTM ČR</h1>
        </div>
        <div style="background: var(--content-app-bg); border: 2px solid var(--chrome-crumb-border); border-radius: 6px; padding: 24px; text-align: center; max-width: 500px; margin: 16px auto;">
          <h2 style="font-size: 1.2rem; font-weight: 800; color: var(--text-primary); margin-bottom: 6px;">Test dokončen!</h2>
          <p style="font-size: 1.05rem; margin-bottom: 16px;">Vaše skóre: <strong>${state.quizScore} z ${data.quiz.length}</strong> správně.</p>
          <button id="restart-quiz-btn" class="btn-source-cuzk" style="border: none; cursor: pointer;">Spustit test znovu</button>
        </div>
      `;
      document.getElementById("restart-quiz-btn")?.addEventListener("click", () => {
        state.quizIndex = 0;
        state.quizScore = 0;
        state.quizAnswered = false;
        renderQuizPage();
      });
      return;
    }

    state.quizAnswered = false;
    const options = q.options.map((opt, idx) => `
      <button class="header-btn quiz-opt-btn" data-idx="${idx}" style="width: 100%; text-align: left; padding: 10px 14px; margin-bottom: 6px; color: var(--text-primary); background: var(--content-bg); border: 1px solid var(--chrome-crumb-border); font-size: 0.88rem;">
        <span style="font-family: var(--font-mono); font-weight: 700; margin-right: 6px; color: var(--brand-orange);">[${String.fromCharCode(65 + idx)}]</span>
        ${opt}
      </button>
    `).join("");

    mainContent.innerHTML = `
      <div style="margin-bottom: 16px; border-bottom: 2px solid var(--chrome-crumb-border); padding-bottom: 10px;" id="sec-tool-content">
        <h1 style="font-size: 1.45rem; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">Znalostní test DTM ČR</h1>
        <p style="color: var(--text-secondary); font-size: 0.85rem;">Otázka ${state.quizIndex + 1} z ${data.quiz.length} • Skóre: ${state.quizScore}</p>
      </div>

      <div style="background: var(--content-app-bg); border: 2px solid var(--chrome-crumb-border); border-radius: 6px; padding: 18px; max-width: 680px;">
        <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary); margin-bottom: 12px;">${q.question}</h3>
        <div>${options}</div>
        <div id="quiz-feedback-box" style="display: none; padding: 10px 14px; border-radius: 4px; margin-top: 10px; font-size: 0.85rem;"></div>
        <button id="quiz-next-btn" class="btn-source-cuzk" style="display: none; margin-top: 10px; border: none; cursor: pointer;">Další otázka →</button>
      </div>
    `;

    mainContent.querySelectorAll(".quiz-opt-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        if (state.quizAnswered) return;
        state.quizAnswered = true;
        const selected = parseInt(btn.dataset.idx, 10);
        const isCorrect = selected === q.correct;
        if (isCorrect) state.quizScore++;

        mainContent.querySelectorAll(".quiz-opt-btn").forEach((b, i) => {
          b.disabled = true;
          if (i === q.correct) {
            b.style.background = "rgba(22, 163, 74, 0.15)";
            b.style.borderColor = "#16a34a";
            b.style.fontWeight = "700";
          } else if (i === selected && !isCorrect) {
            b.style.background = "rgba(220, 38, 38, 0.15)";
            b.style.borderColor = "#dc2626";
          }
        });

        const feedbackBox = document.getElementById("quiz-feedback-box");
        feedbackBox.style.display = "block";
        feedbackBox.style.padding = "0";
        feedbackBox.style.background = "transparent";
        feedbackBox.style.border = "none";
        feedbackBox.innerHTML = renderCallout({
          type: isCorrect ? 'recommendation' : 'alert',
          title: isCorrect ? 'Správná odpověď!' : 'Nesprávná odpověď!',
          titleExtra: isCorrect ? '+1 bod' : '0 bodů',
          contentHtml: `<p style="margin-top: 2px; font-size: 0.85rem; line-height: 1.45;">${q.explanation}</p>`
        });

        const nextBtn = document.getElementById("quiz-next-btn");
        nextBtn.style.display = "inline-flex";
        nextBtn.addEventListener("click", () => {
          state.quizIndex++;
          renderQuizPage();
        });
      });
    });
  }

  // =========================================================================
  // 6. VEKTOROVÁ SCHÉMATA (CAD / ARCHITEKTURA)
  // =========================================================================
  const diagrams = {
    "diagram-crossroad": {
      tabTitle: "Křižovatka OPK",
      title: "Vymezení obvodu pozemní komunikace (OPK) v křižovatce",
      desc: "Silnice II. třídy (průběžná) si zachovává celistvou plochu. Silnice III. třídy se usekává na počátku zakružovacího oblouku. Žádné překryvy v LEVEL = 0.",
      legend: "• <strong>Zelená plocha:</strong> Průběžná komunikace vyšší třídy (např. II/101)<br>• <strong>Modrá plocha:</strong> Připojující se komunikace nižší třídy (III/1012)<br>• <strong>Červená přerušovaná čára:</strong> Hranice napojení (useknutí v počátku oblouku)",
      render: () => `
        <svg viewBox="0 0 700 320" width="100%" height="260" xmlns="http://www.w3.org/2000/svg" style="font-family: var(--font-sans);">
          <defs>
            <pattern id="cad-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(100, 116, 139, 0.12)" stroke-width="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cad-grid)" />

          <polygon points="40,110 660,110 660,210 40,210" fill="rgba(34, 197, 94, 0.15)" stroke="#16a34a" stroke-width="2" />
          <line x1="40" y1="160" x2="660" y2="160" stroke="#15803d" stroke-dasharray="6,4" stroke-width="1.5" />
          <text x="60" y="145" fill="#15803d" font-weight="700" font-size="12">Silnice II. třídy (celistvý polygon OPK)</text>

          <path d="M 280,30 L 400,30 L 400,75 Q 400,110 450,110 L 230,110 Q 280,110 280,75 Z" fill="rgba(68, 131, 252, 0.15)" stroke="#4483fc" stroke-width="2" />
          <line x1="340" y1="30" x2="340" y2="110" stroke="#4483fc" stroke-dasharray="6,4" stroke-width="1.5" />
          <text x="350" y="55" fill="#4483fc" font-weight="700" font-size="11">Silnice III. třídy</text>

          <line x1="230" y1="110" x2="450" y2="110" stroke="#dc2626" stroke-width="3" stroke-dasharray="4,4" />
          <circle cx="230" cy="110" r="4" fill="#dc2626" />
          <circle cx="450" cy="110" r="4" fill="#dc2626" />

          <text x="340" y="132" text-anchor="middle" fill="#dc2626" font-weight="700" font-size="11">Hranice napojení (useknutí v oblouku)</text>
          <text x="340" y="148" text-anchor="middle" fill="#dc2626" font-size="10">Plochy se v LEVEL = 0 nesmí překrývat</text>

          <rect x="40" y="240" width="620" height="55" rx="3" fill="rgba(255,255,255,0.9)" stroke="#cbd5e1"/>
          <text x="55" y="262" fill="#0f172a" font-weight="700" font-size="11">Pravidlo vyhlášky č. 104/1997 Sb., Příloha 3:</text>
          <text x="55" y="280" fill="#475569" font-size="10">Komunikace vyšší třídy si zachovává celistvý polygon. Hranice napojení se vede v bodě tečnosti zakružovacího oblouku.</text>
        </svg>
      `
    },

    "diagram-bridge": {
      tabTitle: "Obvod mostu",
      title: "Obvod mostu a výškové vrstvy LEVEL",
      desc: "Most tvoří uzavřený obal opěr, pilířů, křídel, mostovky a svodidel/zábradlí ve 3. třídě přesnosti (LEVEL = 1).",
      legend: "• <strong>Modrá plocha:</strong> Obvod mostu s atributem LEVEL = 1<br>• <strong>Šedá plocha:</strong> Podjezd na úrovni terénu (LEVEL = 0)<br>• <strong>Červené čárkování:</strong> Mostní zábradlí a svodidla započtená do vnějšího obvodu",
      render: () => `
        <svg viewBox="0 0 700 320" width="100%" height="260" xmlns="http://www.w3.org/2000/svg" style="font-family: var(--font-sans);">
          <rect x="40" y="150" width="620" height="70" fill="rgba(100, 116, 139, 0.12)" stroke="#64748b" stroke-width="1.5" />
          <line x1="40" y1="185" x2="660" y2="185" stroke="#64748b" stroke-dasharray="6,4" stroke-width="1.5" />
          <text x="60" y="190" fill="#334155" font-weight="700" font-size="11">Pozemní komunikace pod mostem (LEVEL = 0)</text>

          <rect x="335" y="130" width="30" height="90" fill="#94a3b8" stroke="#475569" stroke-width="1.5" rx="3"/>
          <text x="350" y="180" text-anchor="middle" fill="#0f172a" font-size="10" font-weight="700">Pilíř</text>

          <rect x="160" y="60" width="380" height="70" fill="rgba(68, 131, 252, 0.15)" stroke="#4483fc" stroke-width="2" rx="3"/>
          <text x="350" y="98" text-anchor="middle" fill="#4483fc" font-weight="800" font-size="13">OBVOD MOSTU (LEVEL = 1)</text>
          <text x="350" y="114" text-anchor="middle" fill="#4483fc" font-size="10">Mostovka, nosná konstrukce a římsy</text>

          <polygon points="120,50 160,60 160,130 120,140" fill="rgba(234, 82, 31, 0.2)" stroke="#ea521f" stroke-width="1.5"/>
          <text x="110" y="98" text-anchor="end" fill="#c04600" font-weight="700" font-size="10">Opěra + křídla</text>

          <polygon points="540,60 580,50 580,140 540,130" fill="rgba(234, 82, 31, 0.2)" stroke="#ea521f" stroke-width="1.5"/>
          <text x="590" y="98" text-anchor="start" fill="#c04600" font-weight="700" font-size="10">Opěra + křídla</text>

          <line x1="160" y1="55" x2="540" y2="55" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="4,4" />
          <line x1="160" y1="135" x2="540" y2="135" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="4,4" />
          <text x="350" y="48" text-anchor="middle" fill="#dc2626" font-size="10" font-weight="700">Mostní zábradlí a svodidla jsou pevnou součástí obvodu</text>

          <rect x="40" y="245" width="620" height="50" rx="3" fill="rgba(255,255,255,0.9)" stroke="#cbd5e1"/>
          <text x="55" y="265" fill="#0f172a" font-weight="700" font-size="11">Metodika 03_obvod_mostu:</text>
          <text x="55" y="282" fill="#475569" font-size="10">Vymezuje se ve 3. třídě přesnosti (poloha i výška). Komunikace na mostě má LEVEL = 1, úsek pod mostem LEVEL = 0.</text>
        </svg>
      `
    },

    "diagram-levels": {
      tabTitle: "Vrstvy LEVEL",
      title: "Vertikální uspořádání prostoru (atribut LEVEL)",
      desc: "Zajišťuje jednoznačnou 3D topologii. Brání neplatným kolizím mezi mosty, povrchem a podzemními sítěmi.",
      legend: "• <strong>LEVEL = 1:</strong> Nadzemní objekty (mosty, estakády, visuté sítě)<br>• <strong>LEVEL = 0:</strong> Povrch terénu (běžný polohopis ZPS)<br>• <strong>LEVEL = -1:</strong> Podzemní stavby a inženýrské sítě",
      render: () => `
        <svg viewBox="0 0 700 320" width="100%" height="260" xmlns="http://www.w3.org/2000/svg" style="font-family: var(--font-sans);">
          <rect x="50" y="25" width="600" height="70" rx="4" fill="rgba(68, 131, 252, 0.1)" stroke="#4483fc" stroke-width="1.5"/>
          <rect x="65" y="40" width="38" height="38" rx="3" fill="#4483fc"/>
          <text x="84" y="64" text-anchor="middle" fill="#fff" font-family="var(--font-mono)" font-weight="700" font-size="14">+1</text>
          <text x="120" y="52" fill="#4483fc" font-weight="700" font-size="13">LEVEL = 1 : Nadzemní objekty</text>
          <text x="120" y="70" fill="#475569" font-size="11">Mosty, nadjezdy, lávky pro pěší, elektrická a optická vedení po sloupech</text>

          <rect x="50" y="115" width="600" height="70" rx="4" fill="rgba(34, 197, 94, 0.1)" stroke="#16a34a" stroke-width="1.5"/>
          <rect x="65" y="130" width="38" height="38" rx="3" fill="#16a34a"/>
          <text x="84" y="154" text-anchor="middle" fill="#fff" font-family="var(--font-mono)" font-weight="700" font-size="14">0</text>
          <text x="120" y="142" fill="#14532d" font-weight="700" font-size="13">LEVEL = 0 : Zemský povrch (Základní prostorová situace ZPS)</text>
          <text x="120" y="160" fill="#475569" font-size="11">Běžné silnice, chodníky, budovy, paty sloupů, poklopy šachet, terén</text>

          <rect x="50" y="205" width="600" height="70" rx="4" fill="rgba(234, 82, 31, 0.1)" stroke="#ea521f" stroke-width="1.5"/>
          <rect x="65" y="220" width="38" height="38" rx="3" fill="#ea521f"/>
          <text x="84" y="244" text-anchor="middle" fill="#fff" font-family="var(--font-mono)" font-weight="700" font-size="14">-1</text>
          <text x="120" y="232" fill="#c04600" font-weight="700" font-size="13">LEVEL = -1 : Podzemní objekty a inženýrské sítě</text>
          <text x="120" y="250" fill="#475569" font-size="11">Vodovody, kanalizace, plynovody, podzemní kabely, silniční tunely a podjezdy</text>
        </svg>
      `
    },

    "diagram-poles": {
      tabTitle: "Vedení po sloupech",
      title: "Nadzemní vedení TI na společných podpěrných bodech",
      desc: "Sloupy se zaměřují na terénu. Linie elektro a optiky tvoří samostatné duplicitní linie se stejnou geometrií v LEVEL = 1.",
      legend: "• <strong>Sloupy (šedá):</strong> Pata zaměřena na terénu v LEVEL = 0<br>• <strong>Červená linie:</strong> Vedení silnoproudu NN v LEVEL = 1<br>• <strong>Modrá linie:</strong> Vedení optické sítě v LEVEL = 1",
      render: () => `
        <svg viewBox="0 0 700 320" width="100%" height="260" xmlns="http://www.w3.org/2000/svg" style="font-family: var(--font-sans);">
          <line x1="40" y1="230" x2="660" y2="230" stroke="#16a34a" stroke-width="3" />
          <text x="50" y="250" fill="#15803d" font-weight="700" font-size="11">Zemský povrch (LEVEL = 0)</text>

          <rect x="140" y="80" width="12" height="150" fill="#64748b" stroke="#334155" stroke-width="1.5" rx="2"/>
          <circle cx="146" cy="230" r="3" fill="#15803d" />
          <text x="146" y="70" text-anchor="middle" font-size="10" font-weight="700" fill="#334155">Sloup 1</text>

          <rect x="340" y="80" width="12" height="150" fill="#64748b" stroke="#334155" stroke-width="1.5" rx="2"/>
          <circle cx="346" cy="230" r="3" fill="#15803d" />
          <text x="346" y="70" text-anchor="middle" font-size="10" font-weight="700" fill="#334155">Sloup 2</text>

          <rect x="540" y="80" width="12" height="150" fill="#64748b" stroke="#334155" stroke-width="1.5" rx="2"/>
          <circle cx="546" cy="230" r="3" fill="#15803d" />
          <text x="546" y="70" text-anchor="middle" font-size="10" font-weight="700" fill="#334155">Sloup 3</text>

          <path d="M 146,100 Q 246,112 346,100 Q 446,112 546,100" fill="none" stroke="#dc2626" stroke-width="2" />
          <text x="246" y="94" text-anchor="middle" fill="#dc2626" font-size="10" font-weight="700">Elektro NN (Linie 1: LEVEL = 1)</text>

          <path d="M 146,135 Q 246,147 346,135 Q 446,147 546,135" fill="none" stroke="#4483fc" stroke-width="2" stroke-dasharray="5,3" />
          <text x="246" y="165" text-anchor="middle" fill="#4483fc" font-size="10" font-weight="700">Optika / Rozhlas (Linie 2: LEVEL = 1)</text>

          <rect x="40" y="270" width="620" height="40" rx="3" fill="rgba(255,255,255,0.9)" stroke="#cbd5e1"/>
          <text x="55" y="292" fill="#475569" font-size="10"><strong>Stanovisko MPS DTM č. 21:</strong> Výšky podpěrných bodů se měří na terénu. Spojnice tvoří samostatné duplicitní linie se svými atributy.</text>
        </svg>
      `
    },

    "diagram-unknown-sewer": {
      tabTitle: "Areálová kanalizace",
      title: "Kanalizace v areálech – Neznámý průběh potrubí",
      desc: "Šachty a jejich dna jsou přesně zaměřeny ve 3. třídě přesnosti. Spojovací roury s neznámou trasou se modelují v 9. třídě.",
      legend: "• <strong>Zelené šachty:</strong> Třída přesnosti 3 (m_xy ≤ 0,14 m, zaměřeno dno i poklop)<br>• <strong>Fialová čárkovaná čára:</strong> Třída přesnosti 9 (poloha nezjištěna, přímá spojnice šachet)",
      render: () => `
        <svg viewBox="0 0 700 320" width="100%" height="260" xmlns="http://www.w3.org/2000/svg" style="font-family: var(--font-sans);">
          <line x1="40" y1="70" x2="660" y2="70" stroke="#94a3b8" stroke-width="2" />
          <text x="50" y="60" fill="#64748b" font-size="10">Úroveň povrchu areálu</text>

          <rect x="280" y="45" width="140" height="60" fill="#cbd5e1" stroke="#475569" stroke-width="1.5" />
          <text x="350" y="80" text-anchor="middle" fill="#1e293b" font-weight="700" font-size="11">Stavební objekt</text>

          <rect x="130" y="70" width="32" height="130" fill="rgba(34, 197, 94, 0.2)" stroke="#16a34a" stroke-width="2" rx="2"/>
          <circle cx="146" cy="70" r="8" fill="#16a34a" />
          <text x="146" y="220" text-anchor="middle" fill="#16a34a" font-weight="700" font-size="10">Šachta A (Třída 3)</text>
          <text x="146" y="232" text-anchor="middle" fill="#64748b" font-size="9">Dno i poklop zaměřeny</text>

          <rect x="530" y="70" width="32" height="150" fill="rgba(34, 197, 94, 0.2)" stroke="#16a34a" stroke-width="2" rx="2"/>
          <circle cx="546" cy="70" r="8" fill="#16a34a" />
          <text x="546" y="240" text-anchor="middle" fill="#16a34a" font-weight="700" font-size="10">Šachta B (Třída 3)</text>
          <text x="546" y="252" text-anchor="middle" fill="#64748b" font-size="9">Dno i poklop zaměřeny</text>

          <line x1="146" y1="190" x2="546" y2="210" stroke="#ea521f" stroke-width="2.5" stroke-dasharray="7,5" />
          <text x="350" y="185" text-anchor="middle" fill="#ea521f" font-weight="700" font-size="11">Trasa potrubí: TŘÍDA PŘESNOSTI 9 (Nezjištěna)</text>
          <text x="350" y="202" text-anchor="middle" fill="#c04600" font-size="10">Přímá spojnice šachet + poznámka "měření po záhozu"</text>

          <rect x="40" y="270" width="620" height="40" rx="3" fill="rgba(255,255,255,0.9)" stroke="#cbd5e1"/>
          <text x="55" y="292" fill="#475569" font-size="10"><strong>Doporučení MPS DTM:</strong> Pokud je poloha neznámá, nevymýšlejte fiktivní ohyby! Veďte přímku v 9. třídě a situaci popište v technické zprávě.</text>
        </svg>
      `
    },

    "diagram-opk-basics": {
      tabTitle: "Příčný řez silnicí",
      title: "Příčný profil pozemní komunikace a rozsah obvodu (OPK)",
      desc: "OPK tvoří celistvé těleso komunikace od paty násypu po korunu zářezu včetně příkopů a krajnic.",
      legend: "• <strong>Vozovka:</strong> Zpevněný jízdní pás<br>• <strong>Krajnice & Příkop:</strong> Konstrukční součásti tělesa PK<br>• <strong>Červené křížky:</strong> Vnější hranice polygonu OPK",
      render: () => `
        <svg viewBox="0 0 700 320" width="100%" height="260" xmlns="http://www.w3.org/2000/svg" style="font-family: var(--font-sans);">
          <line x1="30" y1="150" x2="110" y2="150" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4,4"/>
          <line x1="590" y1="150" x2="670" y2="150" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4,4"/>

          <path d="M 110,150 L 170,210 L 220,210 L 240,180 L 350,175 L 460,180 L 480,210 L 530,210 L 590,150" fill="rgba(100, 116, 139, 0.12)" stroke="#475569" stroke-width="2" />

          <polygon points="240,180 460,180 460,190 240,190" fill="#334155" />
          <text x="350" y="165" text-anchor="middle" fill="#0f172a" font-weight="700" font-size="11">Vozovka</text>

          <text x="225" y="165" text-anchor="middle" fill="#64748b" font-size="10">Krajnice</text>
          <text x="475" y="165" text-anchor="middle" fill="#64748b" font-size="10">Krajnice</text>
          <text x="195" y="230" text-anchor="middle" fill="#4483fc" font-size="10">Příkop</text>
          <text x="505" y="230" text-anchor="middle" fill="#4483fc" font-size="10">Příkop</text>

          <line x1="110" y1="110" x2="110" y2="215" stroke="#dc2626" stroke-width="2" stroke-dasharray="4,4" />
          <circle cx="110" cy="150" r="3" fill="#dc2626" />
          <text x="110" y="100" text-anchor="middle" fill="#dc2626" font-size="10" font-weight="700">Hranice OPK</text>

          <line x1="590" y1="110" x2="590" y2="215" stroke="#dc2626" stroke-width="2" stroke-dasharray="4,4" />
          <circle cx="590" cy="150" r="3" fill="#dc2626" />
          <text x="590" y="100" text-anchor="middle" fill="#dc2626" font-size="10" font-weight="700">Hranice OPK</text>

          <line x1="110" y1="250" x2="590" y2="250" stroke="#16a34a" stroke-width="2.5" />
          <text x="350" y="272" text-anchor="middle" fill="#15803d" font-weight="800" font-size="12">ROZSAH OBVODU POZEMNÍ KOMUNIKACE (OPK)</text>
          <text x="350" y="288" text-anchor="middle" fill="#64748b" font-size="10">Zahrnuje vozovku, krajnice, svahy zářezu i odvodňovací příkopy</text>
        </svg>
      `
    },

    "diagram-driveway": {
      tabTitle: "Sjezdy a propustky",
      title: "Vymezení sjezdu k nemovitosti a propustku vůči tělesu komunikace",
      desc: "Sjezd (vjezd na parcelu) tvoří samostatný polygon a nezahrnuje se do OPK. Propustek pod sjezdem je stavební objekt ZPS na úrovni LEVEL = -1 až 0.",
      legend: "• <strong>Zelená plocha:</strong> Těleso a obvod pozemní komunikace (OPK)<br>• <strong>Oranžová plocha:</strong> Sjezd k nemovitosti (kategorie Ostatní plocha / sjezd)<br>• <strong>Modrá linie:</strong> Příkop komunikace s propustkem pod sjezdem<br>• <strong>Červená čárkovaná čára:</strong> Hranice silničního pozemku / vnější okraj OPK",
      render: () => `
        <svg viewBox="0 0 700 320" width="100%" height="260" xmlns="http://www.w3.org/2000/svg" style="font-family: var(--font-sans);">
          <polygon points="40,160 660,160 660,280 40,280" fill="rgba(34, 197, 94, 0.15)" stroke="#16a34a" stroke-width="2" />
          <line x1="40" y1="220" x2="660" y2="220" stroke="#16a34a" stroke-dasharray="6,4" stroke-width="1.5" />
          <text x="60" y="245" fill="#15803d" font-weight="700" font-size="12">Vozovka a krajnice (Polygon OPK)</text>

          <line x1="40" y1="160" x2="660" y2="160" stroke="#0284c7" stroke-width="3" />
          <text x="60" y="148" fill="#0284c7" font-weight="700" font-size="11">Silniční příkop (odvodnění tělesa)</text>

          <polygon points="260,30 420,30 460,160 220,160" fill="rgba(234, 82, 31, 0.18)" stroke="#ea521f" stroke-width="2" />
          <text x="340" y="85" text-anchor="middle" fill="#c04600" font-weight="800" font-size="12">SJEZD K NEMOVITOSTI</text>
          <text x="340" y="103" text-anchor="middle" fill="#78350f" font-size="10">Samostatný polygon (mimo OPK!)</text>

          <rect x="230" y="152" width="220" height="16" rx="4" fill="#6366f1" stroke="#4338ca" stroke-width="1.5"/>
          <text x="340" y="164" text-anchor="middle" fill="#ffffff" font-weight="700" font-size="10">Propustek pod sjezdem (ZPS, LEVEL = -1 / 0)</text>

          <line x1="40" y1="160" x2="660" y2="160" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="6,4" />
          <circle cx="220" cy="160" r="4" fill="#dc2626" />
          <circle cx="460" cy="160" r="4" fill="#dc2626" />
          <text x="560" y="145" fill="#dc2626" font-weight="700" font-size="10">Hranice OPK / Silničního pozemku</text>

          <rect x="40" y="285" width="620" height="28" rx="3" fill="rgba(255,255,255,0.95)" stroke="#cbd5e1"/>
          <text x="55" y="303" fill="#0f172a" font-size="10"><strong>Stanovisko MPS DTM č. 14:</strong> Sjezd nepatří do OPK silnice. Hranice sjezdu navazuje na hranu tělesa nebo dno příkopu.</text>
        </svg>
      `
    },

    "diagram-roundabout": {
      tabTitle: "Okružní křižovatka",
      title: "Okružní křižovatka (kruhový objezd) v datovém modelu DTM",
      desc: "Okružní pás tvoří souvislou plochu OPK. Dlážděný prstenec má vlastní kód povrchu, nepojížděný středový ostrov je vyjmut jako plocha ZPS.",
      legend: "• <strong>Zelené mezikruží:</strong> Okružní jízdní pás (OPK)<br>• <strong>Oranžový prstenec:</strong> Pojížděný dlážděný prstenec pro nadrozměrnou dopravu<br>• <strong>Šedý střed:</strong> Nepojížděný ostrov (ZPS zeleň / obrubník)<br>• <strong>Modré osy a uzly:</strong> Směrové osy a dopravní uzly křižovatky",
      render: () => `
        <svg viewBox="0 0 700 320" width="100%" height="260" xmlns="http://www.w3.org/2000/svg" style="font-family: var(--font-sans);">
          <rect x="315" y="20" width="70" height="100" fill="rgba(34, 197, 94, 0.15)" stroke="#16a34a" stroke-width="1.5"/>
          <rect x="315" y="200" width="70" height="100" fill="rgba(34, 197, 94, 0.15)" stroke="#16a34a" stroke-width="1.5"/>
          <rect x="60" y="125" width="110" height="70" fill="rgba(34, 197, 94, 0.15)" stroke="#16a34a" stroke-width="1.5"/>
          <rect x="530" y="125" width="110" height="70" fill="rgba(34, 197, 94, 0.15)" stroke="#16a34a" stroke-width="1.5"/>

          <circle cx="350" cy="160" r="115" fill="rgba(34, 197, 94, 0.2)" stroke="#16a34a" stroke-width="2"/>
          <text x="350" y="60" text-anchor="middle" fill="#15803d" font-weight="700" font-size="11">Okružní jízdní pás (OPK)</text>

          <circle cx="350" cy="160" r="75" fill="rgba(234, 82, 31, 0.25)" stroke="#ea521f" stroke-width="1.5" stroke-dasharray="4,2"/>

          <circle cx="350" cy="160" r="50" fill="#e2e8f0" stroke="#475569" stroke-width="2"/>
          <text x="350" y="156" text-anchor="middle" fill="#1e293b" font-weight="800" font-size="11">STŘEDOVÝ</text>
          <text x="350" y="170" text-anchor="middle" fill="#1e293b" font-weight="800" font-size="11">OSTROV</text>
          <text x="350" y="184" text-anchor="middle" fill="#64748b" font-size="9">(ZPS - Zeleň)</text>

          <line x1="410" y1="130" x2="480" y2="100" stroke="#ea521f" stroke-width="1.5"/>
          <text x="485" y="98" fill="#c04600" font-weight="700" font-size="10">Pojížděný prstenec</text>
          <text x="485" y="110" fill="#78350f" font-size="9">(dlážděný povrch pro kamiony)</text>

          <line x1="350" y1="20" x2="350" y2="300" stroke="#4483fc" stroke-dasharray="6,4" stroke-width="1.5"/>
          <line x1="60" y1="160" x2="640" y2="160" stroke="#4483fc" stroke-dasharray="6,4" stroke-width="1.5"/>
          <circle cx="350" cy="160" r="5" fill="#4483fc"/>
          <text x="360" y="145" fill="#4483fc" font-weight="700" font-size="10">Centrální dopravní uzel</text>

          <rect x="40" y="280" width="620" height="32" rx="3" fill="rgba(255,255,255,0.92)" stroke="#cbd5e1"/>
          <text x="55" y="300" fill="#0f172a" font-size="10"><strong>Pravidlo MPS DTM:</strong> Středový nepojížděný ostrov nesmí být součástí OPK. Vzniká otvor v polygonu (vnitřní hranice - inner ring).</text>
        </svg>
      `
    },

    "diagram-networks-corridor": {
      tabTitle: "Koridor sítí v ulici",
      title: "Uliční profil prostorového uspořádání sítí TI dle ČSN 73 6005",
      desc: "Závazné hloubky uložení (krytí) a vzájemné vodorovné odstupy jednotlivých komodit v chodníku a ve vozovce.",
      legend: "• <strong>Fialová:</strong> Optické a sdělovací kabely (krytí 0,5–0,7 m)<br>• <strong>Červená:</strong> Elektro silnoproud NN/VN (krytí 0,7–0,8 m)<br>• <strong>Žlutá:</strong> Plynovod STL (krytí 0,8–1,0 m)<br>• <strong>Modrá:</strong> Vodovodní řad (nezámrzná hloubka 1,2–1,5 m)<br>• <strong>Hnědá:</strong> Gravitační kanalizace (hloubka 1,8–2,5 m)",
      render: () => `
        <svg viewBox="0 0 700 320" width="100%" height="260" xmlns="http://www.w3.org/2000/svg" style="font-family: var(--font-sans);">
          <line x1="30" y1="65" x2="260" y2="65" stroke="#64748b" stroke-width="3"/>
          <text x="40" y="55" fill="#475569" font-weight="700" font-size="11">CHODNÍK (ZPS)</text>

          <rect x="255" y="55" width="12" height="25" fill="#94a3b8" stroke="#334155" stroke-width="1.5"/>
          <line x1="267" y1="75" x2="670" y2="75" stroke="#334155" stroke-width="4"/>
          <text x="280" y="65" fill="#334155" font-weight="700" font-size="11">VOZOVKA (OPK Silnice)</text>

          <line x1="30" y1="110" x2="670" y2="110" stroke="#cbd5e1" stroke-dasharray="3,3" stroke-width="1"/>
          <text x="630" y="105" fill="#94a3b8" font-size="9">-0.50 m</text>

          <line x1="30" y1="140" x2="670" y2="140" stroke="#cbd5e1" stroke-dasharray="3,3" stroke-width="1"/>
          <text x="630" y="135" fill="#94a3b8" font-size="9">-0.80 m</text>

          <line x1="30" y1="185" x2="670" y2="185" stroke="#cbd5e1" stroke-dasharray="3,3" stroke-width="1"/>
          <text x="630" y="180" fill="#94a3b8" font-size="9">-1.30 m</text>

          <line x1="30" y1="235" x2="670" y2="235" stroke="#cbd5e1" stroke-dasharray="3,3" stroke-width="1"/>
          <text x="630" y="230" fill="#94a3b8" font-size="9">-2.00 m</text>

          <rect x="85" y="102" width="22" height="14" rx="2" fill="#6366f1" stroke="#4338ca" stroke-width="1.5"/>
          <text x="96" y="95" text-anchor="middle" fill="#4338ca" font-weight="700" font-size="9">Optika</text>
          <text x="96" y="128" text-anchor="middle" fill="#64748b" font-size="8">h = 0.6 m</text>

          <circle cx="170" cy="135" r="9" fill="#dc2626" stroke="#991b1b" stroke-width="1.5"/>
          <text x="170" y="122" text-anchor="middle" fill="#dc2626" font-weight="700" font-size="9">Elektro NN</text>
          <text x="170" y="155" text-anchor="middle" fill="#64748b" font-size="8">h = 0.8 m</text>

          <circle cx="330" cy="145" r="12" fill="#eab308" stroke="#ca8a04" stroke-width="2"/>
          <text x="330" y="128" text-anchor="middle" fill="#a16207" font-weight="700" font-size="9">Plyn STL (DN100)</text>
          <text x="330" y="168" text-anchor="middle" fill="#64748b" font-size="8">h = 0.9 m</text>

          <circle cx="450" cy="185" r="14" fill="#0284c7" stroke="#0369a1" stroke-width="2"/>
          <text x="450" y="166" text-anchor="middle" fill="#0369a1" font-weight="700" font-size="9">Vodovod (DN150)</text>
          <text x="450" y="210" text-anchor="middle" fill="#64748b" font-size="8">h = 1.4 m (nezámrz)</text>

          <circle cx="560" cy="235" r="18" fill="#78350f" stroke="#451a03" stroke-width="2"/>
          <text x="560" y="212" text-anchor="middle" fill="#78350f" font-weight="700" font-size="9">Kanalizace (DN300)</text>
          <text x="560" y="265" text-anchor="middle" fill="#64748b" font-size="8">h = 2.2 m</text>

          <line x1="330" y1="280" x2="450" y2="280" stroke="#4483fc" stroke-width="1.5"/>
          <line x1="330" y1="275" x2="330" y2="285" stroke="#4483fc" stroke-width="1.5"/>
          <line x1="450" y1="275" x2="450" y2="285" stroke="#4483fc" stroke-width="1.5"/>
          <text x="390" y="275" text-anchor="middle" fill="#4483fc" font-size="9" font-weight="700">min. 0.6 m</text>

          <rect x="40" y="290" width="620" height="24" rx="3" fill="rgba(255,255,255,0.92)" stroke="#cbd5e1"/>
          <text x="55" y="306" fill="#0f172a" font-size="10"><strong>ČSN 73 6005 & DTM:</strong> Všechna podzemní vedení mají atribut LEVEL = -1. Poloha a výška zaměřena ve 3. třídě před záhozem.</text>
        </svg>
      `
    },

    "diagram-pipeline-crossing": {
      tabTitle: "Křížení sítí & Chránička",
      title: "Podzemní křížení inženýrských sítí a modelování chráničky v DTM",
      desc: "Chránička je v JVF DTM samostatný stavební objekt se vztahem k procházejícímu vedení. Přesah min. 0,5 m za vnější líc křížené sítě.",
      legend: "• <strong>Modrá trubka:</strong> Vodovodní řad (průběžné vedení)<br>• <strong>Oranžová chránička:</strong> Ochranná trubka chránící křížený optický/elektro kabel<br>• <strong>Zelené body:</strong> Lomové uzly křížení zaměřené před záhozem (3. třída přesnosti)<br>• <strong>Kóta 0,5 m:</strong> Minimální přesah chráničky na obě strany",
      render: () => `
        <svg viewBox="0 0 700 320" width="100%" height="260" xmlns="http://www.w3.org/2000/svg" style="font-family: var(--font-sans);">
          <text x="50" y="30" fill="#4483fc" font-weight="800" font-size="11">PŮDORYS KŘÍŽENÍ V DTM</text>

          <line x1="50" y1="90" x2="650" y2="90" stroke="#0284c7" stroke-width="10" stroke-linecap="round"/>
          <text x="60" y="75" fill="#0369a1" font-weight="700" font-size="11">Vodovodní řad DN 200 (LEVEL = -1)</text>

          <rect x="330" y="35" width="40" height="110" rx="3" fill="rgba(234, 82, 31, 0.3)" stroke="#ea521f" stroke-width="2"/>
          <line x1="350" y1="20" x2="350" y2="160" stroke="#dc2626" stroke-width="3" stroke-dasharray="6,3"/>
          <text x="380" y="55" fill="#c04600" font-weight="700" font-size="10">Chránička kabelu (DN 110)</text>
          <text x="380" y="68" fill="#475569" font-size="9">Objekt: TI_Chranicka (ZPS/DTI)</text>

          <line x1="310" y1="35" x2="310" y2="85" stroke="#16a34a" stroke-width="1.5"/>
          <text x="300" y="65" text-anchor="end" fill="#15803d" font-weight="700" font-size="10">min. 0.5 m</text>
          <line x1="310" y1="95" x2="310" y2="145" stroke="#16a34a" stroke-width="1.5"/>
          <text x="300" y="125" text-anchor="end" fill="#15803d" font-weight="700" font-size="10">min. 0.5 m</text>

          <line x1="50" y1="180" x2="650" y2="180" stroke="#cbd5e1" stroke-dasharray="4,4"/>
          <text x="50" y="200" fill="#4483fc" font-weight="800" font-size="11">SVISLÝ PROFIL KŘÍŽENÍ (MINIMÁLNÍ ODSTUP)</text>

          <circle cx="350" cy="225" r="16" fill="#0284c7" stroke="#0369a1" stroke-width="2"/>
          <text x="375" y="228" fill="#0369a1" font-weight="700" font-size="10">Vodovod (horní hrana Z = 245.30 m)</text>

          <rect x="338" y="260" width="24" height="24" rx="3" fill="#ea521f" stroke="#9a3412" stroke-width="2"/>
          <text x="375" y="275" fill="#c04600" font-weight="700" font-size="10">Chránička elektro (horní hrana Z = 244.95 m)</text>

          <line x1="325" y1="241" x2="325" y2="260" stroke="#dc2626" stroke-width="2"/>
          <text x="315" y="253" text-anchor="end" fill="#dc2626" font-weight="800" font-size="10">ΔZ ≥ 0.20 m</text>

          <rect x="40" y="295" width="620" height="22" rx="3" fill="rgba(255,255,255,0.95)" stroke="#cbd5e1"/>
          <text x="55" y="310" fill="#0f172a" font-size="10"><strong>Metodika DTI:</strong> V místě křížení musí geodet v otevřeném výkopu zaměřit výšku obou trub i chráničky.</text>
        </svg>
      `
    },

    "diagram-protective-zones": {
      tabTitle: "Ochranná pásma DTI",
      title: "Geometrické vymezení ochranných a bezpečnostních pásem (OP / BP)",
      desc: "Ochranné pásmo se generuje jako polygon z vnějšího líce potrubí nebo krajního vodiče. Pro každou komoditu platí odlišný zákon.",
      legend: "• <strong>Osa potrubí/vedení:</strong> Reálná fyzická trasa v DTM<br>• <strong>Oranžový pruh:</strong> Polygon ochranného pásma (OP)<br>• <strong>Zákon 458/2000 Sb. (Energetický):</strong> Plyn NTL/STL = 1 m, VTL = 4–15 m, Elektro VN = 1–7 m<br>• <strong>Zákon 274/2001 Sb. (Vodovody):</strong> Voda/kanál do DN 500 = 1,5 m, nad DN 500 = 2,5 m",
      render: () => `
        <svg viewBox="0 0 700 320" width="100%" height="260" xmlns="http://www.w3.org/2000/svg" style="font-family: var(--font-sans);">
          <polygon points="50,60 650,60 650,180 50,180" fill="rgba(234, 82, 31, 0.15)" stroke="#ea521f" stroke-width="2" stroke-dasharray="6,4"/>
          <text x="70" y="80" fill="#c04600" font-weight="800" font-size="12">POLYGON OCHRANNÉHO PÁSMA (OP_Objekt)</text>

          <line x1="50" y1="120" x2="650" y2="120" stroke="#ca8a04" stroke-width="12" stroke-linecap="round"/>
          <line x1="50" y1="120" x2="650" y2="120" stroke="#eab308" stroke-dasharray="6,4" stroke-width="2"/>
          <text x="350" y="115" text-anchor="middle" fill="#713f12" font-weight="800" font-size="11">Plynovod STL DN 150 (Fyzická trasa)</text>

          <line x1="280" y1="60" x2="280" y2="114" stroke="#dc2626" stroke-width="1.5"/>
          <text x="290" y="90" fill="#dc2626" font-weight="700" font-size="11">1.0 m (od vnějšího líce)</text>

          <line x1="280" y1="126" x2="280" y2="180" stroke="#dc2626" stroke-width="1.5"/>
          <text x="290" y="160" fill="#dc2626" font-weight="700" font-size="11">1.0 m (od vnějšího líce)</text>

          <rect x="50" y="195" width="600" height="85" rx="4" fill="rgba(255,255,255,0.95)" stroke="#cbd5e1"/>
          <text x="65" y="215" fill="#0f172a" font-weight="800" font-size="11">Zákonné šířky ochranných pásem pro DTM:</text>
          <text x="65" y="235" fill="#475569" font-size="10">• <strong>Plynárenství:</strong> NTL/STL = 1 m | VTL do 40 bar DN 200 = 4 m | VTL nad DN 500 = 12–15 m</text>
          <text x="65" y="252" fill="#475569" font-size="10">• <strong>Elektroenergetika:</strong> Podzemní kabel do 35 kV = 1 m | Nadzemní linka 22 kV = 7 m od krajního vodiče</text>
          <text x="65" y="269" fill="#475569" font-size="10">• <strong>Vodovody a kanalizace:</strong> Do průměru DN 500 = 1,5 m | Nad DN 500 = 2,5 m od vnějšího líce zdi/trubky</text>
        </svg>
      `
    },

    "diagram-surveyor-workflow": {
      tabTitle: "Workflow geodeta & DMVS",
      title: "Životní cyklus zakázky geodeta a validace v IS DMVS",
      desc: "Postup od převzetí podkladů z krajské DTM přes terénní měření a export JVF až po kontrolní službu a zápis krajským editorem.",
      legend: "• <strong>Krok 1–2:</strong> Příprava a terénní měření ÚOZI ve 3. třídě přesnosti<br>• <strong>Krok 3–4:</strong> Tvorba JVF XML a automatická validace v kontrolní službě DMVS<br>• <strong>Krok 5–6:</strong> Ověření oprávněným inženýrem (AZI) a zapracování do DTM kraje",
      render: () => `
        <svg viewBox="0 0 700 320" width="100%" height="260" xmlns="http://www.w3.org/2000/svg" style="font-family: var(--font-sans);">
          <rect x="30" y="40" width="180" height="70" rx="4" fill="rgba(68, 131, 252, 0.12)" stroke="#4483fc" stroke-width="1.5"/>
          <text x="45" y="60" fill="#4483fc" font-weight="800" font-size="11">1. VÝDEJ PODKLADŮ</text>
          <text x="45" y="76" fill="#334155" font-size="10">Stažení JVF DTM z portálu</text>
          <text x="45" y="92" fill="#64748b" font-size="9">IS DMVS / krajský sklad</text>

          <line x1="210" y1="75" x2="250" y2="75" stroke="#4483fc" stroke-width="2"/>

          <rect x="250" y="40" width="190" height="70" rx="4" fill="rgba(234, 82, 31, 0.12)" stroke="#ea521f" stroke-width="1.5"/>
          <text x="265" y="60" fill="#c04600" font-weight="800" font-size="11">2. TERÉNNÍ MĚŘENÍ</text>
          <text x="265" y="76" fill="#334155" font-size="10">GNSS / Tachy ve 3. třídě</text>
          <text x="265" y="92" fill="#78350f" font-size="9">m_xy ≤ 0.14 m, m_z ≤ 0.12 m</text>

          <line x1="440" y1="75" x2="480" y2="75" stroke="#ea521f" stroke-width="2"/>

          <rect x="480" y="40" width="190" height="70" rx="4" fill="rgba(99, 102, 241, 0.12)" stroke="#6366f1" stroke-width="1.5"/>
          <text x="495" y="60" fill="#4338ca" font-weight="800" font-size="11">3. EXPORT DO JVF DTM</text>
          <text x="495" y="76" fill="#334155" font-size="10">Verze 1.4.3 / 1.5.x</text>
          <text x="495" y="92" fill="#475569" font-size="9">GML/XML struktura + vrstvy</text>

          <line x1="575" y1="110" x2="575" y2="150" stroke="#6366f1" stroke-width="2"/>

          <rect x="480" y="150" width="190" height="75" rx="4" fill="rgba(220, 38, 38, 0.1)" stroke="#dc2626" stroke-width="1.5"/>
          <text x="495" y="170" fill="#dc2626" font-weight="800" font-size="11">4. KONTROLNÍ SLUŽBA</text>
          <text x="495" y="186" fill="#334155" font-size="10">Validace DMVS (syntaktická,</text>
          <text x="495" y="200" fill="#334155" font-size="10">geometrická a topologická)</text>
          <text x="495" y="215" fill="#991b1b" font-weight="700" font-size="9">Vydání protokolu o výsledku</text>

          <line x1="480" y1="187" x2="440" y2="187" stroke="#dc2626" stroke-width="2"/>

          <rect x="250" y="150" width="190" height="75" rx="4" fill="rgba(68, 131, 252, 0.12)" stroke="#4483fc" stroke-width="1.5"/>
          <text x="265" y="170" fill="#4483fc" font-weight="800" font-size="11">5. OVĚŘENÍ AZI / ÚOZI</text>
          <text x="265" y="186" fill="#334155" font-size="10">Kvalifikovaný elektronický</text>
          <text x="265" y="200" fill="#334155" font-size="10">podpis s časovým razítkem</text>
          <text x="265" y="215" fill="#1e3a8a" font-size="9">Zákon č. 200/1994 Sb.</text>

          <line x1="250" y1="187" x2="210" y2="187" stroke="#4483fc" stroke-width="2"/>

          <rect x="30" y="150" width="180" height="75" rx="4" fill="rgba(22, 163, 74, 0.15)" stroke="#16a34a" stroke-width="2"/>
          <text x="45" y="170" fill="#15803d" font-weight="800" font-size="11">6. ZÁPIS DO DTM KRAJE</text>
          <text x="45" y="186" fill="#15803d" font-size="10">Aprobace krajským editorem</text>
          <text x="45" y="200" fill="#334155" font-size="10">Zveřejnění pro veřejnost</text>
          <text x="45" y="215" fill="#15803d" font-weight="700" font-size="9">Objekty začleněny do ZPS/DTI</text>

          <rect x="30" y="245" width="640" height="40" rx="3" fill="rgba(255,255,255,0.92)" stroke="#cbd5e1"/>
          <text x="45" y="265" fill="#0f172a" font-weight="700" font-size="10">Klíčová výhoda automatické validace:</text>
          <text x="45" y="278" fill="#475569" font-size="10">Pokud kontrolní služba zjistí křížení bez úrovňového rozlišení nebo chybějící povinný atribut, okamžitě vrátí chybový protokol s číslem prvku.</text>
        </svg>
      `
    }
  };

  // Inicializace aplikace
  buildSidebarTree();
  const initialRoute = window.location.hash.replace("#", "") || "overview";
  navigateTo(initialRoute, false);
});
