/**
 * Atomicon GIS – Core Utilities & Theme Manager
 * Sjednocená funkcionalita pro přepínání motivu, klávesové zkratky a vyhledávání.
 */
(function(window) {
  "use strict";

  var THEME_KEY = "atomicon_theme";

  // 1. Okamžitá aplikace uloženého motivu (light / dark)
  function applyTheme(theme) {
    var validTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", validTheme);
    try {
      localStorage.setItem(THEME_KEY, validTheme);
    } catch (e) {
      /* ignore localstorage security errors */
    }

    // Aktualizace ikon tlačítek přepínače motivu, pokud existují
    var themeButtons = document.querySelectorAll("#theme-toggle, #theme-btn, .theme-toggle-btn");
    themeButtons.forEach(function(btn) {
      btn.setAttribute("aria-label", validTheme === "dark" ? "Přepnout na světlý režim" : "Přepnout na tmavý režim");
      btn.setAttribute("title", validTheme === "dark" ? "Přepnout na světlý režim" : "Přepnout na tmavý režim");
    });
  }

  function getSavedTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY);
      if (saved) return saved;
    } catch (e) {}
    // Pokud není uloženo, respektuj preferenci systému
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme") || getSavedTheme();
    var next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    return next;
  }

  // 2. Normalizace řetězce (Accent-folding pro české texty) dle sekce 5.5
  function normalizeStr(str) {
    if (!str) return "";
    return String(str)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  // 3. Globální klávesová zkratka Ctrl+K pro skok do vyhledávání
  function setupSearchShortcut(inputSelector) {
    window.addEventListener("keydown", function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        var searchInput = document.querySelector(inputSelector || "#global-search, #searchInput, #nameInput, #tab-search, .search-input");
        if (searchInput) {
          searchInput.focus();
          if (searchInput.select) searchInput.select();
        }
      } else if (e.key === "Escape") {
        var active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
          active.blur();
        }
      }
    });
  }

  // Okamžitá aktivace motivu ještě před plným načtením DOMu
  applyTheme(getSavedTheme());

  // Registrace listenerů po načtení DOMu
  document.addEventListener("DOMContentLoaded", function() {
    // Navázání tlačítek motivu
    var themeButtons = document.querySelectorAll("#theme-toggle, #theme-btn, .theme-toggle-btn");
    themeButtons.forEach(function(btn) {
      btn.addEventListener("click", function(e) {
        e.preventDefault();
        toggleTheme();
      });
    });

    setupSearchShortcut();
  });

  // Export do globálního namespace Atomicon
  window.Atomicon = {
    applyTheme: applyTheme,
    getSavedTheme: getSavedTheme,
    toggleTheme: toggleTheme,
    normalizeStr: normalizeStr,
    setupSearchShortcut: setupSearchShortcut
  };

})(window);
