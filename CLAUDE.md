# CLAUDE.md – DTM-protocol (J.E.N.D.A., Atomicon GIS)

Sada statických webových nástrojů pro správu DTM, pasportizaci a podporu obcí.
Rozcestník `index.html` (J.E.N.D.A. = Jednoduché Efektivní Nástroje Do Atomiconu)
odkazuje na jednotlivé nástroje. Vše běží čistě v prohlížeči – **bez build kroku,
bez npm, bez frameworku**. Struktura složek a základní konvence jsou v `README.md`.

## Git – commity a push dělá uživatel sám

- **Nikdy necommituj, nepushuj ani nevytvářej větve/PR.** Uživatel si změny
  prochází a commituje sám v **GitHub Desktop**.
- Jen uprav soubory a na konci stručně shrň, co se změnilo (ideálně se seznamem
  dotčených souborů), aby to šlo snadno projít v GitHub Desktop.
- Nové soubory, bez kterých změna nefunguje (např. sdílené CSS/JS), výslovně zmiň,
  aby je uživatel při commitu nezapomněl zaškrtnout.

## Jazyk

- Uživatel komunikuje česky – odpovídej česky.
- Celé UI, komentáře v kódu i texty v nástrojích jsou česky; drž to tak.

## Lokální spuštění a ověření

- Statický server je nastavený v `.claude/launch.json` (konfigurace `hub`,
  `python -m http.server 8765`) → http://localhost:8765/
- V Git Bash není `python` v PATH – pro skripty použij `py` (Python 3.6).
- Změny UI ověřuj v prohlížeči na localhostu (ne přes `file://` – tam se nenačtou
  externí CSS/JS soubory). Kontroluj i tmavý režim a úzké okno, kde to dává smysl.

## Struktura (stručně)

- `index.html` + `assets/css/hub.css` + `assets/js/jenda.js` – rozcestník
  (karty nástrojů v 7 sekcích, oblíbené, vyhledávání, panel s moduly, changelog, maskot).
- `tools/<sekce>/*.html` – jednosouborové nástroje (HTML + inline CSS + inline JS).
- `apps/<nazev>/` – vícesouborové aplikace (`index.html`, vlastní CSS/JS).
- `assets/js/pasport/` – sdílené moduly textových pasportů (záloha, kontroly, ARES, Word).
- `assets/css/preview-actions.css` + `assets/js/preview-actions.js` – sdílená plovoucí
  akční tlačítka vpravo od náhledu (viz níže).
- `assets/vendor/` – knihovny třetích stran (Leaflet, Quill, docx). Neupravovat.
- Cesty ze `tools/` i `apps/` jsou relativní z hloubky 2: `../../assets/...`.

## Konvence a vzory

### Karty v rozcestníku
- Každá karta má třídu (např. `card kom`) a barvu v `assets/css/hub.css`
  (blok „Barvy a témata pro jednotlivé karty“: `--c` + `--bg`).
- **Barva ikony karty = hlavní barva (motiv) panelu v daném nástroji**
  (typicky barva `.btn-primary` / akčních tlačítek). Při změně motivu nástroje
  uprav i kartu a naopak.
- Experimentální nástroje (`card experimental`) mají záměrně šedé ikony.
- Nový nástroj: karta do správné sekce v `index.html` (s `data-tool-id`, ikonou
  `<symbol>` ve spritu nahoře v `index.html`) + barva v `hub.css`.

### Cache-busting
- `index.html` načítá `hub.css?v=…` a `jenda.js?v=…`. Po úpravě těchto souborů
  zvedni verzi (formát `RRRRMMDD` + písmeno, např. `20261125a`).

### Nástroje s panelem vlevo a náhledem vpravo
- Rozložení: `.app` grid `<šířka panelu>px 1fr`; levý `.form-panel` má vlastní scroll:
  `max-height: 100vh; position: sticky; top: 0; overflow-y: auto;` – náhled se
  posouvá zvlášť se stránkou.
- Export a akce (PDF, Word, Zálohovat, Načíst, Vymazat…) patří do **plovoucí lišty
  vpravo vedle náhledu**, ne dolů do panelu:
  - pasporty (`tools/pasporty/`) ji mají inline (`.preview-actions` v jejich `<style>`);
  - ostatní nástroje používají sdílené soubory:
    ```html
    <link rel="stylesheet" href="../../assets/css/preview-actions.css">
    <script src="../../assets/js/preview-actions.js" defer></script>
    ...
    <div class="preview-actions" data-anchor="#page"
         style="--pa-primary-bg: #…; --pa-primary-hover: #…; --pa-secondary-bg: #…; --pa-secondary-fg: #…">
      <button type="button" class="preview-action preview-action-primary" …>
        <svg>…</svg><span class="preview-action-label">PDF</span>
      </button>
      …
    </div>
    ```
  - `data-anchor` = selektor stránky náhledu (lze i více, bere se první viditelný);
    barvy přes proměnné `--pa-*` podle motivu nástroje; tlačítko pro mazání/obnovu
    dostává navíc `preview-action-danger`.
- Tisk/PDF přes `window.print()` + `@media print` (skrýt panel a akční tlačítka).

### Styl kódu
- Vanilla JS, bez závislostí na build nástrojích; externí knihovny jen přes CDN
  s pevnou verzí (unpkg / jsdelivr / cdnjs) nebo z `assets/vendor/`.
- Každý nástroj má vlastní barevný motiv a favicon (SVG vedle souboru nebo inline data URI).
- Text vkládaný do `innerHTML` z uživatelského vstupu escapuj.

### Changelog
- Novinky jsou ručně v `index.html` (sekce „changelog“ v bočním panelu + modální
  historie). Upravuj jen na výslovné požádání.
