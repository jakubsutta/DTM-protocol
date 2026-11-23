/**
 * Pomocné / utility funkce sdílené napříč moduly.
 */
var CityInfo = window.CityInfo || {};

CityInfo.Helpers = (function() {
  "use strict";

  function qs(params) {
    return Object.keys(params).map(function(k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    }).join("&");
  }

  function fetchJson(url, opts) {
    return fetch(url, opts).then(function(r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function withTimeout(promise, ms) {
    return new Promise(function(resolve, reject) {
      var t = setTimeout(function() { reject(new Error("timeout")); }, ms);
      promise.then(
        function(v) { clearTimeout(t); resolve(v); },
        function(e) { clearTimeout(t); reject(e); }
      );
    });
  }

  function ruianQuery(layer, params, timeoutMs) {
    var base = { f: "json", outFields: "*" };
    Object.keys(params).forEach(function(k) { base[k] = params[k]; });
    var url = CityInfo.Config.RUIAN + "/" + layer + "/query?" + qs(base);
    return withTimeout(fetchJson(url), timeoutMs || 8000);
  }

  function stripDiacritics(s) {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function risSlug(nazev) {
    return stripDiacritics(nazev)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function debounce(fn, ms) {
    var t;
    return function() {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function() { fn.apply(ctx, args); }, ms);
    };
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c];
    });
  }

  function sqlEscape(s) {
    return String(s).replace(/'/g, "''");
  }

  function setStatus(el, msg, isErr) {
    el.textContent = msg || "";
    el.classList.toggle("err", !!isErr);
  }

  function normalizeUrl(u) {
    if (/^https?:\/\//i.test(u)) return u;
    return "http://" + u;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback for older browsers
    return new Promise(function(resolve, reject) {
      var t = document.createElement("textarea");
      t.value = text;
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.focus();
      t.select();
      try {
        document.execCommand("copy");
        resolve();
      } catch (err) {
        reject(err);
      }
      document.body.removeChild(t);
    });
  }

  function fetchWikidataInfo(nazev) {
    var wbUrl = "https://www.wikidata.org/w/api.php?action=wbgetentities&sites=cswiki&titles=" + encodeURIComponent(nazev) + "&props=claims&format=json&origin=*";
    return fetchJson(wbUrl).then(function(j) {
      if (!j.entities) return { logoUrl: null, mayorName: null };
      var pageId = Object.keys(j.entities)[0];
      if (pageId === "-1" || !j.entities[pageId].claims) return { logoUrl: null, mayorName: null };
      
      var claims = j.entities[pageId].claims;
      var out = { logoUrl: null, mayorName: null };
      var promises = [];

      // 1) Logo
      if (claims.P94 && claims.P94[0]) {
        var fileName = claims.P94[0].mainsnak.datavalue.value;
        var commonsUrl = "https://commons.wikimedia.org/w/api.php?action=query&titles=File:" + encodeURIComponent(fileName.replace(/ /g, "_")) + "&prop=imageinfo&iiprop=url&iiurlwidth=60&format=json&origin=*";
        promises.push(fetchJson(commonsUrl).then(function(cj) {
          if (!cj.query || !cj.query.pages) return;
          var cPageId = Object.keys(cj.query.pages)[0];
          var info = cj.query.pages[cPageId].imageinfo;
          if (info && info[0] && info[0].thumburl) {
            out.logoUrl = info[0].thumburl;
          }
        }).catch(function(){}));
      }

      // 2) Mayor (Starosta - z textu české Wikipedie, je to mnohem spolehlivější než Wikidata P6 pro malé obce)
      var wikiUrl = "https://cs.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=" + encodeURIComponent(nazev) + "&format=json&origin=*";
      promises.push(fetchJson(wikiUrl).then(function(wj) {
        if (!wj.query || !wj.query.pages) return;
        var wPageId = Object.keys(wj.query.pages)[0];
        if (wPageId === "-1") return;
        var wikitext = wj.query.pages[wPageId].revisions[0].slots.main['*'];
        var match = wikitext.match(/\|\s*starosta\s*=\s*(.+)/i);
        if (match) {
          var name = match[1].trim();
          name = name.replace(/<!--.*?-->/g, ''); // remove comments
          name = name.replace(/<ref[^>]*>.*?<\/ref>/g, ''); // remove refs
          name = name.replace(/<[^>]+>/g, ''); // remove html tags
          name = name.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1'); // simplify wiki links
          name = name.replace(/{{[^}]+}}/g, ''); // remove wiki templates (e.g. {{Vd}})
          name = name.trim();
          if (name && name !== "-" && name.toLowerCase() !== "ne") {
            out.mayorName = name;
          }
        }
      }).catch(function(){}));

      return Promise.all(promises).then(function() { return out; });
    }).catch(function() { return { logoUrl: null, mayorName: null }; });
  }

  return {
    qs: qs,
    fetchJson: fetchJson,
    withTimeout: withTimeout,
    ruianQuery: ruianQuery,
    stripDiacritics: stripDiacritics,
    risSlug: risSlug,
    debounce: debounce,
    esc: esc,
    sqlEscape: sqlEscape,
    setStatus: setStatus,
    normalizeUrl: normalizeUrl,
    copyToClipboard: copyToClipboard,
    fetchWikidataInfo: fetchWikidataInfo
  };
})();
