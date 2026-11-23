# DTM-protocol (Atomicon GIS)

Sada statických webových nástrojů pro správu DTM, pasportizaci a podporu obcí.
Vstupním bodem je rozcestník `index.html`. Vše běží v prohlížeči bez build kroku.

## Struktura

```
index.html, favicon.svg     Rozcestník (dashboard)
assets/
  css/hub.css               Styl rozcestníku
  css/design-system.css     Sdílený design systém (aplikace + Seznam DZ)
  js/atomicon-core.js       Sdílené JS jádro
  js/pasport/               Společné funkce textových pasportů (tools/pasporty):
                              core.js    dialogy, oznámení, barvy pasportu
                              backup.js  záloha do souboru, automatické ukládání, ochrana dat
                              checks.js  kontrola před PDF, hlídání přetečení A4, název PDF
                              ares.js    doplnění IČO/DIČ a adresy z ARES
                              docx.js    export do Wordu
  img/                      Logo, pozadí rozcestníku, dz/ = SVG dopravních značek
  vendor/                   Knihovny třetích stran (Leaflet, Quill, docx)
apps/                       Vícesouborové aplikace (vlastní složka, index.html)
  modul-dtm/                Mapový modul DTM
  modul-katastr/            Katastrální mapa
  metodika-dtm/             Metodika DTM
  city-info/                Informace o obcích
  map-generator/            Generátor map
  jvf-validator/            Validátor JVF (modely 1.4.3 a 1.5.0.2)
tools/                      Jednosouborové nástroje, členěné dle sekcí rozcestníku
  protokoly/                1) Protokoly, validace
  exporty/                  2) Tabulky, karty, kalendář
  pasporty/                 3) Textové části pasportů
  analyza/                  4) Data, analytické nástroje
  propagace/                5) Propagace, tisk
  databaze/                 6) Databáze, pomůcky
  experimentalni/           7) Experimentální nástroje
```

## Konvence

- Nová vícesouborová aplikace → `apps/<nazev>/index.html`; do rozcestníku odkaz `./apps/<nazev>/index.html`.
- Nový jednosouborový nástroj → `tools/<sekce>/`; vlastní favicon ukládat vedle něj.
- Sdílené soubory odkazovat relativně z hloubky 2: `../../assets/...`, zpět na rozcestník `../../index.html`.

## Lokální spuštění

```sh
python3 -m http.server 8000
# http://localhost:8000/
```
