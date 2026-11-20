/**
 * Databáze znalostí DTM ČR pro DI (Dopravní infrastruktura) a TI (Technická infrastruktura)
 * Zdroje a metodické podklady:
 * - DTMwiki ČÚZK: https://dtmwiki.cuzk.gov.cz/start
 * - DI Metodika: https://dtmwiki.cuzk.gov.cz/03_di_metodika
 * - TI Metodika: https://dtmwiki.cuzk.gov.cz/ti
 * - Vyhláška č. 393/2020 Sb. o digitální technické mapě kraje
 * - Vyhláška č. 104/1997 Sb., kterou se provádí zákon o pozemních komunikacích
 * - Zákon č. 200/1994 Sb., o zeměměřictví (novely 47/2020 Sb. a 287/2025 Sb.)
 * - Stavební zákon č. 283/2021 Sb.
 */

window.DTM_DATA = {
  metadata: {
    title: "DTM ČR – Technický a metodický portál DI a TI",
    version: "JVF DTM 1.4.3 / 1.5.x",
    legislation: "Vyhláška č. 393/2020 Sb. • Zákon č. 200/1994 Sb.",
    lastUpdated: "Aktualizováno dle platných stanovisek MPS DTM",
    primarySources: [
      { name: "DTMwiki ČÚZK – Hlavní rozcestník", url: "https://dtmwiki.cuzk.gov.cz/start" },
      { name: "DTMwiki – Dopravní infrastruktura (DI)", url: "https://dtmwiki.cuzk.gov.cz/03_di_metodika" },
      { name: "DTMwiki – Technická infrastruktura (TI)", url: "https://dtmwiki.cuzk.gov.cz/ti" },
      { name: "IS DMVS – Portál ČÚZK", url: "https://www.cuzk.cz/DMVS/O-IS-DMVS.aspx" },
      { name: "Slovník datového modelu DTM", url: "https://app.iprpraha.cz/apl/app/slovnik-dtm/" }
    ]
  },

  // Hierarchické sekce pro navigační strom
  tree: [
    {
      id: "cat-di",
      name: "1. Dopravní infrastruktura (DI)",
      badge: "DI",
      items: [
        { id: "di-opk-zaklad", title: "Obvod pozemní komunikace (OPK)", code: "OPK-01" },
        { id: "di-krizovatky", title: "Křižovatky a priority napojení", code: "OPK-02" },
        { id: "di-obvod-mostu", title: "Obvod mostu a konstrukční části", code: "MOST-01" },
        { id: "di-level-vysky", title: "Výškové úrovně LEVEL v DI", code: "LEVEL-DI" },
        { id: "di-osa-uzly", title: "Osa komunikace a dopravní uzly", code: "OSA-01" },
        { id: "di-drahy-ostatni", title: "Železnice, tramvaje a letiště", code: "DRAHY-01" }
      ]
    },
    {
      id: "cat-ti",
      name: "2. Technická infrastruktura (TI)",
      badge: "TI",
      items: [
        { id: "ti-prehled-siti", title: "Kategorie a druhy 7 sítí TI", code: "TI-SITI" },
        { id: "ti-zjednodusene-vedeni", title: "Zjednodušené vedení (NeuplnaData)", code: "TI-ZJEDN" },
        { id: "ti-podperne-body-sloupy", title: "Vedení TI po sloupech (LEVEL +1)", code: "TI-SLOUP" },
        { id: "ti-kanalizace-neznama", title: "Kanalizace v areálech (třída 9)", code: "TI-KANAL" },
        { id: "ti-optika-vlakna", title: "Optické sítě a mapování vláken", code: "TI-OPTIK" },
        { id: "ti-ochranna-pasma", title: "Ochranná a bezpečnostní pásma", code: "TI-PASMA" },
        { id: "ti-casti-dti", title: "Části DTI a působnost správce", code: "TI-CASTI" }
      ]
    },
    {
      id: "cat-meta",
      name: "3. Společná metodika a JVF",
      badge: "STD",
      items: [
        { id: "meta-zps-vs-dti", title: "Rozdíl ZPS (kraj) vs. DTI (správci)", code: "ZPS-DTI" },
        { id: "meta-jvf-dtm", title: "Formát JVF DTM (XML / GML)", code: "JVF-SPEC" },
        { id: "meta-postup-geodeta", title: "Postup zakázky geodeta (ÚOZI)", code: "UOZI-FLOW" },
        { id: "meta-postup-obce", title: "Povinnosti obcí jako vlastníků sítí", code: "OBEC-FLOW" }
      ]
    },
    {
      id: "cat-tools",
      name: "4. Nástroje a reference",
      badge: "REF",
      items: [
        { id: "tool-diagrams", title: "Technická CAD schémata", code: "SVG" },
        { id: "tool-cheatsheet", title: "Třídy přesnosti (1–9) & Slovník", code: "TAB" },
        { id: "tool-mistakes", title: "Katalog častých chyb (Špatně vs. Správně)", code: "ERR" },
        { id: "tool-decision", title: "Rádce: Co dělat když...", code: "HOW" },
        { id: "tool-quiz", title: "Znalostní test DTM", code: "TEST" }
      ]
    }
  ],

  // Rychlý přehled tříd přesnosti
  accuracyClasses: [
    { classNum: "1", mxy: "≤ 0,04 m", mz: "≤ 0,06 m", code: "TRIDA_1", usage: "Přímé geodetické měření otevřeného výkopu před záhozem. Novostavby vodovodů, plynárenských řadů, kanalizačních den." },
    { classNum: "2", mxy: "≤ 0,08 m", mz: "≤ 0,12 m", code: "TRIDA_2", usage: "Vysoce přesná polohopisná měření povrchových znaků a bodů ZPS." },
    { classNum: "3", mxy: "≤ 0,14 m", mz: "≤ 0,18 m", code: "TRIDA_3", usage: "Základní zákonný standard pro polohopis ZPS a podmínka pro plnou evidenci sítí DTI (NeuplnaData = 0)." },
    { classNum: "4", mxy: "≤ 0,26 m", mz: "≤ 0,35 m", code: "TRIDA_4", usage: "Převzatá technická dokumentace starších staveb, vektorizace přesnějších technických map." },
    { classNum: "5", mxy: "≤ 0,50 m", mz: "≤ 0,70 m", code: "TRIDA_5", usage: "Orientační pasporty obcí, digitalizace archivních map bez přímého geodetického zaměření." },
    { classNum: "9", mxy: "Nezjištěna", mz: "Nezjištěna", code: "TRIDA_9", usage: "Záměry z projektové dokumentace (územní rozhodnutí), neznámý průběh kanalizace mezi šachtami uvnitř areálů." }
  ],

  // Slovník pojmů
  glossary: [
    { term: "DTM", full: "Digitální technická mapa kraje", desc: "Geografická databáze velkého měřítka obsahující ZPS a sítě DTI, spravovaná krajem podle § 4b zákona č. 200/1994 Sb." },
    { term: "DI", full: "Dopravní infrastruktura", desc: "Liniové a plošné objekty silniční, drážní, letecké a vodní sítě (obvody komunikací, osy, mosty, uzly)." },
    { term: "TI", full: "Technická infrastruktura", desc: "Inženýrské sítě rozvodu energií, médií a dat (voda, kanalizace, plyn, elektro, teplo, optika/sdělovací sítě, produktovody)." },
    { term: "DTI", full: "Dopravní a technická infrastruktura", desc: "Společný legislativní termín pro sítě a zařízení spravované jejich vlastníky, správci nebo provozovateli." },
    { term: "ZPS", full: "Základní prostorová situace", desc: "Objekty zemského povrchu (budovy, terénní hrany, komunikace, ploty, obrubníky, vegetace). Pořizuje a garantuje kraj." },
    { term: "VSP", full: "Vlastník, správce nebo provozovatel", desc: "Právnická nebo fyzická osoba ze zákona odpovědná za správnost a předání dat své sítě do DTM." },
    { term: "ÚOZI", full: "Úředně oprávněný zeměměřický inženýr", desc: "Autorizovaný zeměměřič ověřující výsledky zeměměřických činností (DSPS) v souladu s právními předpisy." },
    { term: "JVF DTM", full: "Jednotný výměnný formát DTM", desc: "XML/GML standard definovaný ČÚZK (v1.4.3 a novější v1.5.x) pro export, validaci a import geodat." },
    { term: "IS DMVS", full: "Informační systém Digitální mapy veřejné správy", desc: "Centrální systém ČÚZK propojující všech 14 krajských IS DTM, registr subjektů a agendu vyjadřování." },
    { term: "OPK", full: "Obvod pozemní komunikace", desc: "Uzavřený polygon vymezený tělesem komunikace (vozovka, krajnice, svahy, příkopy), který se v jedné úrovni nesmí překrývat." },
    { term: "LEVEL", full: "Úroveň vertikálního umístění", desc: "Relativní výšková vrstva objektu vůči terénu: 0 = zemský povrch, +1 = mosty a nadzemní vedení, -1 = tunely a podzemní sítě." },
    { term: "Části DTI", full: "Území působnosti správce infrastruktury", desc: "Polygonové vymezení území, ve kterém má VSP síť a kde mu stavební úřady zasílají žádosti o vyjádření ke stavbám." }
  ],

  // 17 Hlavních témat s kompletními legislativními a technickými daty
  topics: [
    // -------------------------------------------------------------------------
    // SEKCE: DOPRAVNÍ INFRASTRUKTURA (DI)
    // -------------------------------------------------------------------------
    {
      id: "di-opk-zaklad",
      category: "DI",
      categoryName: "Dopravní infrastruktura",
      code: "OPK-01",
      title: "Obvod pozemní komunikace (OPK) – Zásady a vymezení",
      shortTitle: "Obvod komunikace (OPK)",
      standardRef: "Vyhláška č. 104/1997 Sb. • Zákon č. 13/1997 Sb., § 11–13 • DTMwiki 03_di_metodika",
      summary: "Základní plošný prvek silniční sítě v DTM. Vymezuje těleso komunikace odvozené ze ZPS. Plochy OPK se v téže výškové úrovni nesmí nikdy překrývat.",
      plainExplain: "Obvod pozemní komunikace v DTM netvoří pouze asfaltový pás pro jízdu aut, ale kompletní stavební těleso: jízdní pruhy, zpevněné i nezpevněné krajnice, silniční příkopy a svahy zářezů či násypů. V DTM musí vytvářet souvislou plochu bez mezer a bez překryvů s okolními komunikacemi v dané úrovni.",
      keyRules: [
        "Vychází ze zákona o pozemních komunikacích č. 13/1997 Sb. a definice silničního pozemku.",
        "V extravilánu sahá hranice obvodu PK po vnější patu násypu, vnější hranu silničního příkopu nebo horní korunu zářezu.",
        "V intravilánu (v zástavbě) je obvod ohraničen lícem obrubníku přilehlého chodníku, hranicí silničního pozemku, ploty nebo uliční čarou.",
        "ZÁKAZ PŘEKRYVU: V jedné výškové úrovni (LEVEL = 0) se plochy obvodů komunikací nesmí topologicky překrývat.",
        "Součástí OPK jsou přímo navazující parkovací zálivy, autobusové zastávky a odpočívky patřící k tělesu dané komunikace."
      ],
      legalInfo: {
        act: "Zákon č. 13/1997 Sb., o pozemních komunikacích (§ 11–13) a Vyhláška č. 104/1997 Sb.",
        paragraphs: "§ 11 odst. 1 zákona č. 13/1997 Sb. definuje silniční pozemek a součásti dálnice, silnice a místní komunikace. Vyhláška č. 393/2020 Sb. o DTM kraje předepisuje vedení obvodu PK jako uzavřené plochy.",
        jvfElement: "ObjektDI: ObvodPozemniKomunikace (Plocha)",
        attributes: "KategorieObjektu: DI, TypObjektu: ObvodPozemniKomunikace, TridaPresnostiPolohy: 3 (m_xy ≤ 0.14 m), LEVEL: 0 (nebo 1 na mostě)"
      },
      tags: ["DI", "OPK", "Plochy", "Extravilán", "Intravilán", "Topologie"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/03_di_metodika",
      svgDiagram: "diagram-opk-basics"
    },
    {
      id: "di-krizovatky",
      category: "DI",
      categoryName: "Dopravní infrastruktura",
      code: "OPK-02",
      title: "Vymezování křižovatek v DTM – Prioritní pravidla a napojení",
      shortTitle: "Křižovatky v obvodu PK",
      standardRef: "Vyhláška č. 104/1997 Sb., Příloha č. 3 • Metodika MPS DTM",
      summary: "Pravidla pro topologické dělení ploch v křížení komunikací. Vyšší třída si zachovává celistvou průběžnou plochu, napojovaná komunikace se usekává na počátku zakružovacího oblouku.",
      plainExplain: "V místě křížení dvou silnic nesmí vzniknout společný průnik obou ploch. Systém DTM vyžaduje jednoznačného vlastníka plochy. Proto má silnice vyšší kategorie přednost a její plocha zůstává celistvá. Vedlejší silnice se k ní připojuje a je useknuta přesně v místě, kde začíná zakružovací oblouk křižovatky.",
      keyRules: [
        "Hierarchie priorit: Dálnice > Silnice I. třídy > Silnice II. třídy > Silnice III. třídy > Místní komunikace > Účelové komunikace.",
        "Komunikace s vyšší prioritou prochází křižovatkou celistvě. Komunikace s nižší prioritou se usekne na počátku zakružovacího oblouku (hranice napojení).",
        "Křížení silnic stejné třídy (např. II. s II.): Přednost má komunikace s nižším evidenčním číslem silnice (např. II/101 má přednost před II/108), případně dopravně hlavní trasa.",
        "Křižovatky tvaru 'T': Vyšší prioritu má průběžná komunikace. Pokud hlavní komunikace odbočuje a průběžná je vedlejší, řídí se předností v jízdě dle dopravního značení.",
        "Okružní křižovatky: Celý okružní pás včetně středového ostrova a dělicích ostrůvků náleží komunikaci s vyšší prioritou. Vstupní a výstupní paprsky vedlejších větví se usekávají na vnějším obvodu okruhu."
      ],
      legalInfo: {
        act: "Vyhláška č. 104/1997 Sb., Příloha č. 3 (Vymezení křižovatek) • Vyhláška č. 393/2020 Sb.",
        paragraphs: "Příloha č. 3 vyhlášky č. 104/1997 Sb. stanoví způsob oddělení tělesa pozemní komunikace v křižovatkách na počátku zakružovacího oblouku.",
        jvfElement: "Topologická hrana rozhraní dvou ploch ObvodPozemniKomunikace",
        attributes: "Vzájemný styk bez polygonového průniku. Topologická čistota: Nesmí vzniknout překryv (overlap) ani mezera (gap)."
      },
      tags: ["DI", "Křižovatky", "OPK", "Priority", "Okružní křižovatky", "Vyhláška 104"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/03_di_metodika",
      svgDiagram: "diagram-crossroad"
    },
    {
      id: "di-obvod-mostu",
      category: "DI",
      categoryName: "Dopravní infrastruktura",
      code: "MOST-01",
      title: "Obvod mostu – Geometrické vymezení a stavební součásti",
      shortTitle: "Obvod mostu a součásti",
      standardRef: "Vyhláška č. 393/2020 Sb., Příloha č. 1 • Metodika DI kapitola 03_obvod_mostu",
      summary: "Mostní objekt se vymezuje ve 3. třídě přesnosti jako jednolitý obalový polygon všech nosných i opěrných stavebních částí, které mostu umožňují samostatnou existenci.",
      plainExplain: "Most v DTM není jen vzdušná čára, ale plošný prvek obalující celou konstrukci: mostovku, pilíře, krajní opěry zapuštěné v násypu, šikmá mostní křídla, římsy a bezpečnostní prvky (svodidla a zábradlí). Komunikace na mostě se navíc označí atributem LEVEL = 1, čímž se zamezí chybovému křížení se silnicí či tokem pod mostem.",
      keyRules: [
        "Obvod mostu je uzavřený 2D obalový polygon vymezující vnější půdorysný průmět celého mostního díla.",
        "Do obvodu PATŘÍ: Opěry, pilíře, mostní křídla, mostovka, nosná konstrukce, římsy, odvodňovací žlaby, přilehlá mostní svodidla a mostní zábradlí.",
        "Do obvodu NEPATŘÍ: Běžná navazující silniční zábradlí na zemním tělese, samostatné reklamní poutače nebo vyčnívající konzoly trakčního vedení.",
        "Přiřazení úrovně: Komunikace procházející po mostě má atribut LEVEL = 1. Pozemní komunikace nebo vodní tok pod mostem má LEVEL = 0.",
        "Požadavek na přesnost: Vymezení polohy i výšky musí splňovat 3. třídu přesnosti (m_xy ≤ 0,14 m, m_z ≤ 0,18 m)."
      ],
      legalInfo: {
        act: "Vyhláška č. 393/2020 Sb., Příloha 1 (Datový model ZPS a DI) • ČSN 73 6200 (Mostní názvosloví)",
        paragraphs: "Most je stavebním objektem překonávajícím terénní překážku. V DTM tvoří samostatnou plochu ObvodMostu v geodetické 3. třídě přesnosti.",
        jvfElement: "ObjektDI: ObvodMostu (Plocha)",
        attributes: "TridaPresnostiPolohy: 3, TridaPresnostiVysky: 3, LEVEL: 1, Soucasti: Opery, Mostovka, Kridla, Zabrany"
      },
      tags: ["DI", "Mosty", "LEVEL:1", "Konstrukce", "Třída 3", "Opěry"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/03_di_metodika",
      svgDiagram: "diagram-bridge"
    },
    {
      id: "di-level-vysky",
      category: "DI",
      categoryName: "Dopravní infrastruktura",
      code: "LEVEL-DI",
      title: "Výškové úrovně (atribut LEVEL) v dopravní infrastruktuře",
      shortTitle: "Úrovně LEVEL (-1, 0, +1)",
      standardRef: "Datový model JVF DTM 1.4.x / 1.5.x • Vyhláška č. 393/2020 Sb.",
      summary: "Atribut LEVEL řeší 3D vertikální uspořádání prostoru. Umožňuje vést více komunikací nad sebou (mosty, tunely, estakády) bez hlášení neplatných plošných kolizí.",
      plainExplain: "Když silnice překonává jinou silnici po mostě nebo vchází do tunelu, dochází k prostorovému křížení. Bez výškového atributu by validační systém DTM taková data odmítl jako nepovolený překryv. Atribut LEVEL říká, ve kterém patře se těleso nachází.",
      keyRules: [
        "LEVEL = 0: Standardní zemský povrch. Patří sem drtivá většina silnic na zemním tělese.",
        "LEVEL = 1: První nadzemní úroveň (mosty, nadjezdy, visuté estakády a lávky pro pěší).",
        "LEVEL = -1: Podzemní úroveň (silniční tunely, zakryté podjezdy, hloubené galerie).",
        "LEVEL = 2 a vyšší: Víceúrovňové křižovatky (např. estakáda vedoucí nad jiným mostním objektem).",
        "V místě přechodu ze země na most (na dilatačním závěru nebo opěře) se polygon OPK rozdělí na úsek LEVEL 0 a úsek LEVEL 1."
      ],
      legalInfo: {
        act: "Vyhláška č. 393/2020 Sb., o digitální technické mapě kraje • Datové schéma JVF DTM",
        paragraphs: "Atribut LEVEL vyjadřuje vertikální relaci prvku vůči standardnímu zemskému povrchu a dalším stavebním objektům.",
        jvfElement: "Společný atribut všech prostorových prvků DTI i ZPS: <LEVEL>",
        attributes: "Hodnoty: -1 (podzemí/tunel), 0 (povrch), 1 (most/nadzemí), 2..n (patra mimoúrovňových křížení)"
      },
      tags: ["DI", "LEVEL", "Tunely", "Mosty", "3D Topologie", "Validace"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/03_di_metodika",
      svgDiagram: "diagram-levels"
    },
    {
      id: "di-osa-uzly",
      category: "DI",
      categoryName: "Dopravní infrastruktura",
      code: "OSA-01",
      title: "Osa pozemní komunikace a dopravní uzly",
      shortTitle: "Osa silnice a dopravní uzly",
      standardRef: "Metodika DI ČÚZK • Silniční databanka (SDB ŘSD)",
      summary: "Liniová reprezentace dopravní sítě sloužící pro výpočet staničení (kilometráže), směrové trasování a vazbu na celostátní Silniční databanku.",
      plainExplain: "Zatímco obvod (OPK) je plošný polygon asfaltu a příkopů, osa je tenká 3D křivka běžící středem komunikace. Umožňuje přesné měření délek, navigaci, evidenci staničení a propojení se systémem ŘSD.",
      keyRules: [
        "Osa komunikace je vedena geometrickým středem zpevněné části vozovky.",
        "U směrově dělených komunikací (dálnice, čtyřpruhové silnice I. třídy) se vedou dvě samostatné osy pro každý jízdní směr zvlášť.",
        "Dopravní uzly tvoří koncové a lomové body, ve kterých dochází k větvení nebo zaústění silničních úseků.",
        "Atributy osy obsahují číslo silnice, třídu, správce, provozní staničení a příznak směrovosti."
      ],
      legalInfo: {
        act: "Zákon č. 13/1997 Sb. • Technické podmínky TP 179 (Navrhování silnic) • JVF DTM",
        paragraphs: "Osa PK tvoří grafickou reprezentaci silniční sítě ve smyslu zákona o pozemních komunikacích propojenou s pasportem silnic.",
        jvfElement: "ObjektDI: OsaPozemniKomunikace (Linie3D), DopravniUzel (Bod)",
        attributes: "TridaPK (Dalnice, I, II, III, MK), CisloSilnice, SmerJizdy, SpravceKomunikace, ProvozniStaniceniOd/Do"
      },
      tags: ["DI", "Osa PK", "Uzly", "SDB", "Staničení", "ŘSD"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/03_di_metodika",
      svgDiagram: "diagram-roundabout"
    },
    {
      id: "di-drahy-ostatni",
      category: "DI",
      categoryName: "Dopravní infrastruktura",
      code: "DRAHY-01",
      title: "Železniční, tramvajová a letecká infrastruktura",
      shortTitle: "Dráhy, tramvaje a letiště",
      standardRef: "Zákon o dráhách č. 266/1994 Sb. • Zákon o civilním letectví č. 49/1997 Sb.",
      summary: "Pravidla pro vymezení obvodů drážního tělesa, os železničních a tramvajových kolejí, trolejových vedení a letištních vzletových a přistávacích drah.",
      plainExplain: "V DTM se kromě silnic evidují i všechny ostatní druhy dopravy. Železnice má vlastní těleso dráhy a osy kolejí. Tramvaje na vlastním tělese mají samostatný obvod, zatímco tramvaje ve vozovce jsou integrovány do obvodu silnice.",
      keyRules: [
        "Železniční síť se skládá z obvodu tělesa dráhy a liniových prvků (osy kolejí, nástupištní hrany).",
        "Tramvajový pás ležící přímo ve vozovce tvoří součást obvodu pozemní komunikace (s atributem typu povrchu).",
        "Samostatné tramvajové trati mají vlastní obvod dráhy nezávislý na okolních silnicích.",
        "Letecká infrastruktura zahrnuje zpevněné i nezpevněné vzletové a přistávací dráhy (VPD), pojezdové dráhy a odbavovací plochy."
      ],
      legalInfo: {
        act: "Zákon č. 266/1994 Sb., o dráhách • Vyhláška č. 393/2020 Sb.",
        paragraphs: "§ 4a zákona o dráhách definuje obvod dráhy jako území určené pro těleso dráhy a její stavby. V DTM tvoří samostatnou vrstvu spravovanou Správou železnic či dopravními podniky.",
        jvfElement: "ObjektDI: ObvodDrahy (Plocha), OsaKoleje (Linie), LetistniPlocha (Plocha)",
        attributes: "DruhDrahy (Zeleznicni, Tramvajova, Lanova), Rozchod, ProvozovatelDrahy"
      },
      tags: ["DI", "Železnice", "Tramvaje", "Dráhy", "Letiště", "Správa železnic"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/03_di_metodika",
      svgDiagram: "diagram-driveway"
    },

    // -------------------------------------------------------------------------
    // SEKCE: TECHNICKÁ INFRASTRUKTURA (TI)
    // -------------------------------------------------------------------------
    {
      id: "ti-prehled-siti",
      category: "TI",
      categoryName: "Technická infrastruktura",
      code: "TI-SITI",
      title: "Přehled 7 komodit technické infrastruktury v DTM",
      shortTitle: "Kategorie a druhy sítí TI",
      standardRef: "Vyhláška č. 393/2020 Sb., Příloha č. 1 • Datový model JVF DTM",
      summary: "Technická infrastruktura v DTM pokrývá 7 hlavních komodit: voda, kanalizace, plyn, elektro, teplo, elektronické komunikace a produktovody.",
      plainExplain: "Každá inženýrská síť má v DTM definovanou vlastní skupinu objektů, barevný standard, pravidla trasování a vazbu na konkrétního správce či provozovatele. Všechny podzemní trubky a kabely se standardně modelují v LEVELu -1.",
      keyRules: [
        "Voda: Přivaděče, rozvodné řady, vodovodní přípojky, armaturní šachty, hydranty, vodojemy a úpravny vody.",
        "Kanalizace: Splašková, dešťová a jednotná kanalizace; gravitační i tlaková; revizní šachty, uliční vpusti, čerpací stanice a ČOV.",
        "Plyn: Vysokotlak (VTL), středotlak (STL), nízkotlak (NTL); hlavní uzávěry plynu (HUP), regulační stanice a trasové uzávěry.",
        "Elektro: Velmi vysoké (VVN), vysoké (VN) a nízké napětí (NN); trafostanice, rozpojovací skříně, stožáry, sloupy a veřejné osvětlení.",
        "Teplo: Parovody, horkovody, teplovody, výměníkové a předávací stanice.",
        "Elektronické komunikace: Dálkové i místní optické a metalické sítě, chráničky, kabelové komory, HDPE mikrotrubičky.",
        "Produktovody: Ropovody, produktovody pohonných hmot, dálková průmyslová potrubí."
      ],
      legalInfo: {
        act: "Vyhláška č. 393/2020 Sb., Příloha 1 (Seznam objektů a zařízení TI) • Zákon č. 200/1994 Sb., § 4b",
        paragraphs: "§ 4b zákona o zeměměřictví ukládá všem vlastníkům technické infrastruktury povinnost předávat údaje o svých sítích do DTM kraje.",
        jvfElement: "ObjektTI (TrasaVedei, ZarizeniSite, Chranicka, ObalSite)",
        attributes: "KategorieTI (Vodovodni, Kanalizacni, Plynarenska, Elektro, Teplarenska, Telekomunikacni, Produktovod), Vlastnik, Spravce, LEVEL"
      },
      tags: ["TI", "Sítě", "Voda", "Kanalizace", "Plyn", "Elektro", "Optika", "Teplo"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/ti",
      svgDiagram: "diagram-networks-corridor"
    },
    {
      id: "ti-zjednodusene-vedeni",
      category: "TI",
      categoryName: "Technická infrastruktura",
      code: "TI-ZJEDN",
      title: "Zjednodušené vedení údajů o DTI (NeuplnaData = 1)",
      shortTitle: "Zjednodušené vedení TI",
      standardRef: "§ 4 odst. 3 vyhlášky č. 393/2020 Sb. • DTMwiki kapitola 1.1.7 a 1.4.7.1",
      summary: "Pravidla pro předání dat o stávajících sítích bez nutnosti nového výkopového měření. Definuje povinné minimální atributy pro zaevidování do DTM.",
      plainExplain: "Pokud obec nebo správce vlastní starý vodovod či kabel zakreslený jen orientačně na papíře, zákon nevyžaduje rozkopání ulic. Umožňuje předat data ve zjednodušeném režimu s atributem NeuplnaData = 1. Vyplní se pouze typ sítě, subjekt, přibližná trasa a úroveň umístění.",
      keyRules: [
        "Příznak NeuplnaData = 1: Aplikuje se vždy, pokud přesnost polohy neodpovídá alespoň 3. třídě přesnosti (např. třída 4, 5 nebo 9) NEBO chybí nepovinné provozní atributy.",
        "Příznak NeuplnaData = 0 (Úplná evidence): Vyžaduje splnění obou podmínek: 1. třída přesnosti alespoň 3 (m_xy ≤ 0,14 m), 2. vyplnění všech požadovaných atributů.",
        "MINIMÁLNÍ povinné položky při zjednodušeném vedení: 1. Druh prvku (kategorie, skupina, typ), 2. Subjekt (alespoň jeden z trojice: vlastník, správce nebo provozovatel), 3. Geometrie polohy, 4. Atribut LEVEL.",
        "V novějších verzích schématu JVF DTM 1.5.x hodnotu atributu NeuplnaData nastavuje systém kraje automaticky na základě reálně vyplněných položek a třídy přesnosti."
      ],
      legalInfo: {
        act: "Vyhláška č. 393/2020 Sb., § 4 odst. 3 (Zjednodušený způsob vedení údajů)",
        paragraphs: "Podle § 4 odst. 3 vyhlášky se při zjednodušeném vedení vedou údaje o druhu, poloze, úrovni umístění a alespoň jednom subjektu (vlastník/správce/provozovatel).",
        jvfElement: "Atribut objektu DTI: <NeuplnaData>1</NeuplnaData>",
        attributes: "Povinné minimum: Druh (kategorie, skupina, typ), Subjekt (Vlastnik/Spravce), Poloha (Geometrie GML), LEVEL (-1, 0, 1)"
      },
      tags: ["TI", "Zjednodušené vedení", "NeuplnaData", "Obce", "Legislativa", "Vyhláška 393"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/index.php?title=1.1.7._Zjednodu%C5%A1en%C3%A9_veden%C3%AD_%C3%BAdaje_o_DTI",
      svgDiagram: "diagram-unknown-sewer"
    },
    {
      id: "ti-podperne-body-sloupy",
      category: "TI",
      categoryName: "Technická infrastruktura",
      code: "TI-SLOUP",
      title: "Nadzemní vedení TI na podpěrných bodech (sloupech)",
      shortTitle: "Vedení po sloupech (LEVEL +1)",
      standardRef: "Stanovisko MPS DTM č. 21 • Metodika TI ČÚZK • ČSN 33 2000",
      summary: "Metodika pro elektrická vedení, optiku, kabelovou televizi a obecní rozhlas po sloupech. Pravidla pro zaměření paty sloupu a řešení duplicit.",
      plainExplain: "Na vesnicích a v menších městech často visí na jednom betonovém sloupu elektrické vedení NN, pod ním obecní rozhlas a ještě optický kabel. Sloupy se zaměří jako bodové prvky na terénu. Linie všech zavěšených sítí se vedou v LEVELu +1 a vytvářejí se jako samostatné duplicitní linie se shodnými souřadnicemi lomů.",
      keyRules: [
        "Úroveň umístění: Všechna nadzemní vedení zavěšená na podpěrných bodech mají atribut LEVEL = 1.",
        "Výška měření: Výška podpěrných bodů se standardně zaměřuje na úrovni terénu (pata sloupu). Linie vedení se vytváří prostým propojením těchto bodů.",
        "Skutečná výška vodičů: Zaměřuje se pouze v případě, kdy to správce sítě prokazatelně eviduje a vyžaduje ve své interní GIS dokumentaci.",
        "Duplicitní linie: Běží-li po stejné řadě sloupů více různých médií (např. elektro + optický kabel), vytváří se pro každý typ sítě samostatná linie se shodnými souřadnicemi.",
        "Sjednocení sloupů: Každý správce zaměří sloupy pro svou síť; případné duplicity bodových prvků v ZPS řeší správce krajské DTM při konsolidaci dat."
      ],
      legalInfo: {
        act: "Stanovisko MPS DTM č. 21 (Nadzemní TI vedoucí po podpěrných bodech)",
        paragraphs: "Schváleno Metodickou pracovní skupinou DTM dne 19. 10. 2022. Upravuje vztah bodových prvků PodpernyBod k liniím nadzemního vedení v LEVEL = 1.",
        jvfElement: "ObjektTI: TrasaVedeni (Linie3D, LEVEL=1), ObjektZPS: PodpernyBod (Bod, LEVEL=0)",
        attributes: "TypVedeni (Elektro, Optika, Sdelovaci), ZpusobUlozeni: Nadzemni, LEVEL: 1"
      },
      tags: ["TI", "Sloupy", "Podpěrné body", "LEVEL:1", "Nadzemní vedení", "Duplicity"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/ti",
      svgDiagram: "diagram-poles"
    },
    {
      id: "ti-kanalizace-neznama",
      category: "TI",
      categoryName: "Technická infrastruktura",
      code: "TI-KANAL",
      title: "Kanalizace v areálech – Neznámý průběh mezi šachtami",
      shortTitle: "Neznámý průběh kanalizace",
      standardRef: "Stanovisko MPS DTM č. 18 & 19 • Vyhláška č. 393/2020 Sb.",
      summary: "Závazný postup DTMwiki pro mapování kanalizací v uzavřených průmyslových a nemocničních areálech, kde jsou viditelné šachty, ale přesná trasa rour není známa.",
      plainExplain: "V továrním areálu nebo staré čtvrti vidíte kanalizační poklopy, ale netušíte, zda potrubí mezi nimi vede přímo, nebo uhýbá kolem starých základů. Geodet zaměří šachty a jejich dna přesně ve 3. třídě, ale spojovací linii mezi nimi označí 9. třídou přesnosti (nezjištěno) a do technické zprávy zapíše měření po záhozu.",
      keyRules: [
        "Bodové objekty (šachty, poklopy, vstupní komory a dna) se zaměří standardně ve 3. třídě přesnosti (m_xy ≤ 0,14 m, m_z ≤ 0,18 m).",
        "Spojovací linie potrubí mezi šachtami s neznámým průběhem se vede v 9. TŘÍDĚ PŘESNOSTI (polohová odchylka nezjištěna).",
        "Způsob pořízení linie se označí jako 'měření po záhozu' nebo 'převzato z archivu'.",
        "Geodet je povinen tuto skutečnost výslovně uvést v technické zprávě zakázky.",
        "Kombinace přesností: Poloha linie může být evidována v 9. třídě, zatímco výškový spád (odvozený ze zaměřených den šachet) ve 3. třídě přesnosti."
      ],
      legalInfo: {
        act: "Stanovisko MPS DTM č. 18 (Kanalizace v areálech – neznámý průběh) a č. 19 (Upřesnění trasy)",
        paragraphs: "Schváleno MPS DTM dne 19. 10. 2022 a aktualizováno 13. 03. 2024. Povoluje vést spojnici šachet v 9. třídě přesnosti bez rozkopávání areálu.",
        jvfElement: "ObjektTI: TrasaKanalizace (Linie3D), ZarizeniKanalizace: Sachta (Bod)",
        attributes: "Linie: TridaPresnostiPolohy: 9, TridaPresnostiVysky: 3, ZpusobPorizeni: PoZahozu. Šachta: TridaPresnosti: 3"
      },
      tags: ["TI", "Kanalizace", "Neznámý průběh", "Třída 9", "Areály", "Šachty"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/ti",
      svgDiagram: "diagram-unknown-sewer"
    },
    {
      id: "ti-optika-vlakna",
      category: "TI",
      categoryName: "Technická infrastruktura",
      code: "TI-OPTIK",
      title: "Optické sítě a mapování vláken v DTM",
      shortTitle: "Optické sítě a chráničky",
      standardRef: "Stanovisko MPS DTM č. 17 • Zákon č. 127/2005 Sb., o elektronických komunikacích",
      summary: "Do DTM se mapuje výhradně fyzická trasa chráničky nebo vnějšího kabelu. Jednotlivá optická vlákna uvnitř svazku se v DTM nikdy neevidují.",
      plainExplain: "V jednom optickém kabelu může být 96 nebo 144 mikroskopických skleněných vláken. Do DTM se NIKDY nekreslí jednotlivá vlákna! Kreslí se pouze fyzický obal – tedy trasa chráničky (trubky HDPE) nebo vnějšího kabelu. Do DTM vkládá data ten, kdo vlastní fyzickou infrastrukturu v zemi.",
      keyRules: [
        "V DTM se eviduje fyzická prostorová trasa kabelovodu, chráničky (HDPE trubky) nebo přímo uloženého kabelu.",
        "Jednotlivá optická vlákna se v DTM NEMAPUJÍ – jejich zapojení je předmětem vnitřního provozního GIS systému operátora.",
        "Sdílená infrastruktura: Má-li obec nebo kraj pronajato 'temné vlákno' v cizím kabelu, trasu do DTM vkládá vlastník fyzického kabelu/chráničky.",
        "Vlastní chránička: Pokud obec vybudovala vlastní trubku HDPE, vkládá do DTM trasu chráničky s údaji o dimenzi a materiálu."
      ],
      legalInfo: {
        act: "Stanovisko MPS DTM č. 17 (Pořizování trasy sítě elektronické komunikace – mapování vláken)",
        paragraphs: "Schváleno MPS DTM dne 21. 12. 2022. Řeší, že v DTM se mapuje pouze nosič (trubka / kabel), nikoli virtuální či vnitřní přenosové kanály a vlákna.",
        jvfElement: "ObjektTI: TrasaElektronickeKomunikace (Linie3D), Chranicka (Linie3D)",
        attributes: "DruhKabelu: Opticky, MaterialChranicky: HDPE, TypVlastnictvi: FyzickaInfrastruktura"
      },
      tags: ["TI", "Optika", "Vlákna", "Elektronické komunikace", "Chráničky", "HDPE"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/ti",
      svgDiagram: "diagram-pipeline-crossing"
    },
    {
      id: "ti-ochranna-pasma",
      category: "TI",
      categoryName: "Technická infrastruktura",
      code: "TI-PASMA",
      title: "Ochranná a bezpečnostní pásma (OP a BP) v DTM",
      shortTitle: "Ochranná pásma TI",
      standardRef: "Energetický zákon č. 458/2000 Sb. • Zákon o vodovodech č. 274/2001 Sb. • DTMwiki č. 23",
      summary: "Pravidla pro generování polygonů pásem kolem inženýrských sítí. Zásadní rozdíl mezi stávající realizovanou sítí a budoucím záměrem.",
      plainExplain: "Kolem plynovodů, vysokého napětí i vodovodů existují ze zákona ochranná pásma, kde se nesmí stavět ani kopat bez souhlasu. V DTM se ochranné pásmo stávající sítě vypočítá obalem kolem zaměřené trubky. U plánované stavby (záměru) se pásmo převezme z projektu v 9. třídě přesnosti.",
      keyRules: [
        "Stávající sítě: Ochranné pásmo (OP) se generuje jako buffer (obalová plocha) z reálně zaměřené trasy sítě dle zákonem stanovené šířky.",
        "Přesnost OP existující sítě odpovídá třídě přesnosti samotné podkladové sítě.",
        "Stádium ZÁMĚRU: U plánovaných sítí, které ještě fyzicky neleží v zemi, ale mají stavební povolení, vzniká OP ze zákona. Vkládá se z projektové dokumentace v 9. třídě přesnosti s atributem 'Záměr'.",
        "Po dokončení stavby a geodetickém zaměření se data záměru nahradí skutečným provedením stavby (DSPS).",
        "Údaje o ochranných pásmech jsou nezbytné pro stavební úřady při posuzování nových záměrů."
      ],
      legalInfo: {
        act: "Stanovisko MPS DTM č. 23 (Vymezení ochranného a bezpečnostního pásma TI) • Energetický zákon č. 458/2000 Sb.",
        paragraphs: "Schváleno MPS DTM dne 18. 10. 2023. Závazně definuje tvorbu OP z existujících sítí i vkládání záměrů z projektové dokumentace v 9. třídě.",
        jvfElement: "ObjektTI: OchrannPasmaTI (Plocha)",
        attributes: "DruhPasma (Ochranne, Bezpecnostni), TridaPresnosti: shodná se sítí (u záměru 9), Popis: Záměr (pokud ještě nestojí)"
      },
      tags: ["TI", "Ochranná pásma", "Bezpečnostní pásma", "Záměr", "Buffer", "Legislativa"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/ti",
      svgDiagram: "diagram-protective-zones"
    },
    {
      id: "ti-casti-dti",
      category: "TI",
      categoryName: "Technická infrastruktura",
      code: "TI-CASTI",
      title: "Části DTI – Území působnosti správce pro vyjádření",
      shortTitle: "Části DTI (Působnost správce)",
      standardRef: "Stavební zákon č. 283/2021 Sb., § 168 • IS DMVS ČÚZK • DTMwiki č. 14",
      summary: "Plošné polygony vymezené v centrálním systému IS DMVS, kde má správce infrastrukturu a kde mu systém automaticky generuje žádosti o vyjádření ke stavbám.",
      plainExplain: "Aby stavebník nemusel obíhat 50 různých správců v republice, IS DMVS se podívá na místo jeho plánované stavby. Pokud stavba leží v polygonu 'Část DTI' daného správce vodovodu nebo plynu, systém mu automaticky pošle výzvu k vyjádření. Správce si tak vymezí území, které ho zajímá.",
      keyRules: [
        "Část DTI je plošný polygon evidovaný v centrálním IS DMVS spravovaném ČÚZK.",
        "Vymezuje územní rozsah, ve kterém vlastník/správce plní zákonnou povinnost vyjadřovat se ke stavebním záměrům dle stavebního zákona č. 283/2021 Sb.",
        "Polygon nemusí těsně kopírovat jednotlivá potrubí – může pokrývat celé katastrální území nebo obec, kde správce působí.",
        "Nevymezí-li vlastník své území působnosti a nevloží data, pohlíží se na území tak, jako by v něm žádná síť nebyla (riziko překopnutí bez právní ochrany)."
      ],
      legalInfo: {
        act: "Stanovisko MPS DTM č. 14 (Části dopravní a technické infrastruktury) • Stavební zákon č. 283/2021 Sb.",
        paragraphs: "Podle § 168 stavebního zákona je vyjádření vlastníka DTI povinnou součástí žádosti o povolení záměru. Rozsah se určuje právě z polygonů Části DTI.",
        jvfElement: "IS DMVS Administrační objekt: CastDTI (Polygon působnosti)",
        attributes: "IdentifikatorSubjektu, IC, NazevSubjektu, DruhInfrastruktury, KontaktProVyjadreni"
      },
      tags: ["TI", "Části DTI", "IS DMVS", "Vyjádření", "Stavební řízení", "Správci"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/ti",
      svgDiagram: "diagram-protective-zones"
    },

    // -------------------------------------------------------------------------
    // SEKCE: SPOLEČNÁ METODIKA, JVF DTM A PRAXE
    // -------------------------------------------------------------------------
    {
      id: "meta-zps-vs-dti",
      category: "METODIKA",
      categoryName: "Společná metodika",
      code: "ZPS-DTI",
      title: "Rozdělení kompetencí: ZPS (kraj) vs. DTI (vlastníci sítí)",
      shortTitle: "ZPS vs DTI – Kompetence",
      standardRef: "Zákon č. 200/1994 Sb., § 4b • Vyhláška č. 393/2020 Sb.",
      summary: "Základní kompetenční rozdělení DTM: polohopis povrchu (ZPS) garantuje krajský úřad, inženýrské sítě (DTI) garantují jejich vlastníci a provozovatelé.",
      plainExplain: "Nejčastější začátečnický omyl v DTM je představa, že kraj zodpovídá za všechno. Kraj odpovídá výhradně za zemský povrch ZPS (cesty, domy, terén, ploty, obrubníky). Za sítě odpovídají jejich vlastníci (ČEZ, plynárny, obec s vodovodem). Geodet po stavbě odevzdává povrchové prvky kraji a podzemní sítě příslušnému provozovateli.",
      keyRules: [
        "ZPS (Základní prostorová situace): Správcem a garantem je příslušný KRAJSKÝ ÚŘAD.",
        "DTI (Dopravní a technická infrastruktura): Správcem a garantem je VLASTNÍK / PROVOZOVATEL dané sítě.",
        "Odpovědnost za data: Vlastník sítě neručí za přesnost okolního polohopisu v ZPS, odpovídá výhradně za svou síť.",
        "Předávání dat: ZPS se po realizaci stavby předává přes integrační rozhraní krajskému IS DTM, data sítí jdou správci dané sítě."
      ],
      legalInfo: {
        act: "Zákon č. 200/1994 Sb., o zeměměřictví (§ 4b a § 4c) ve znění novely 47/2020 Sb.",
        paragraphs: "Kraj vede a spravuje DTM kraje. Vlastníci DTI jsou povinni předávat údaje o své infrastruktuře. Vlastník neodpovídá za ZPS ani okolní stavby.",
        jvfElement: "Oddělené datové sady v JVF DTM: <ZPS_Data> a <DTI_Data>",
        attributes: "Garance: Kraj (ZPS) vs. Subjekt VSP (DTI). Schválení probíhá dvoukolejně."
      },
      tags: ["METODIKA", "ZPS", "DTI", "Kraje", "Správci sítí", "Odpovědnost"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/start",
      svgDiagram: "diagram-levels"
    },
    {
      id: "meta-jvf-dtm",
      category: "METODIKA",
      categoryName: "Společná metodika",
      code: "JVF-SPEC",
      title: "JVF DTM – Jednotný výměnný formát (XML / GML)",
      shortTitle: "JVF DTM datový standard",
      standardRef: "Technická specifikace ČÚZK • Schémata XSD v1.4.3 a v1.5.x",
      summary: "Oficiální datový formát pro předávání a validaci zeměměřických zakázek v DTM ČR založený na standardu OGC GML.",
      plainExplain: "JVF DTM je standardizovaný XML soubor. Každý bod, linie i plocha v něm má přesně definované souřadnice X, Y, Z v S-JTSK a Bpv, třídu přesnosti a seznam povinných atributů. Před zapracováním prochází soubor automatickými kontrolami.",
      keyRules: [
        "Založen na mezinárodním standardu OGC GML a XSD schématech garantovaných ČÚZK.",
        "Automatické validace: Každý soubor JVF DTM prochází v IS DMVS a krajských systémech přísnou kontrolou.",
        "Kontroluje se: syntaktická správnost XML, topologie (křížení bez uzlů, nedovolené překryvy), povinné atributy a vazba na číslo zakázky.",
        "Chyba ve validaci znamená automatické odmítnutí celého předání. Doporučuje se data předem otestovat na validačním portálu ČÚZK."
      ],
      legalInfo: {
        act: "Vyhláška č. 393/2020 Sb., Příloha č. 3 (Výměnný formát DTM) • Schválená specifikace ČÚZK",
        paragraphs: "Předepisuje jednotnou strukturu dat v jazyce XML/GML splňující specifikaci OGC Simple Features Profile.",
        jvfElement: "Kořenový element: <jvf:JVF_DTM xmlns:jvf=...>",
        attributes: "Verze: 1.4.3 nebo 1.5.0, Souřadnicový systém: urn:ogc:def:crs:EPSG::5514, Výškový systém: Bpv"
      },
      tags: ["METODIKA", "JVF DTM", "GML", "XML", "Validace", "S-JTSK", "Bpv"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/start",
      svgDiagram: "diagram-surveyor-workflow"
    },
    {
      id: "meta-postup-geodeta",
      category: "METODIKA",
      categoryName: "Společná metodika",
      code: "UOZI-FLOW",
      title: "Životní cyklus zakázky geodeta (ÚOZI) v DTM",
      shortTitle: "Postup pro geodety (ÚOZI)",
      standardRef: "Zákon č. 200/1994 Sb. • Vyhláška č. 393/2020 Sb. • ČÚZK pokyny",
      summary: "Krok za krokem: od založení zakázky a stažení podkladů z IS DMVS, přes měření otevřeného výkopu až po autorizaci a odevzdání JVF DTM.",
      plainExplain: "Praktický postup geodeta: 1. Založí zakázku v portálu DMVS a vyžádá si okolní data. 2. Změří stavbu v terénu ještě před zahrnutím rýhy (třída 1 nebo 3). 3. Vytvoří JVF DTM s rozdělením na ZPS a sítě. 4. Data ověří ÚOZI a odešle přes rozhraní do DTM.",
      keyRules: [
        "1. KROK: Založení zakázky v IS DMVS a získání unikátního ID zakázky s výdejem stávajících dat okolí.",
        "2. KROK: Terénní zaměření – sítě DTI se měří před záhozem (otevřený výkop = 1. nebo 3. třída). Po záhozu už nelze dosáhnout 1. třídy!",
        "3. KROK: Zpracování v certifikovaném CAD/GIS softwaru do formátu JVF DTM.",
        "4. KROK: Autorizace úředně oprávněným zeměměřickým inženýrem (ÚOZI) s kvalifikovaným elektronickým podpisem.",
        "5. KROK: Odevzdání do IS DMVS / IS DTM kraje s úspěšnou kontrolou validačního protokolu."
      ],
      legalInfo: {
        act: "Zákon č. 200/1994 Sb., o zeměměřictví (§ 12–16) • Vyhláška č. 393/2020 Sb.",
        paragraphs: "Úředně oprávněný zeměměřický inženýr (ÚOZI) odpovídá za odbornou úroveň, správnost a soulad měření s technickými předpisy.",
        jvfElement: "Hlavička zakázky JVF DTM: <ZememerickaCinnost>",
        attributes: "CisloZakazkyDMVS, UOZI_Jmeno, UOZI_CisloOvereni, DatumOvereni, ElektronickyPodpis"
      },
      tags: ["METODIKA", "Geodeti", "ÚOZI", "DSPS", "Zakázka", "Pracovní postup"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/start",
      svgDiagram: "diagram-surveyor-workflow"
    },
    {
      id: "meta-postup-obce",
      category: "METODIKA",
      categoryName: "Společná metodika",
      code: "OBEC-FLOW",
      title: "Povinnosti obcí a měst jako vlastníků vodovodů a kanalizací",
      shortTitle: "Průvodce pro obce a města",
      standardRef: "§ 4b zákona č. 200/1994 Sb. • Vyhláška č. 393/2020 Sb. • DTMwiki č. 16",
      summary: "Zákonné povinnosti samospráv, registrace v IS DMVS, smluvní pověření provozovatele (VaK) a řešení historických pasportů.",
      plainExplain: "Každá obec v ČR vlastní část infrastruktury – místní silnice, chodníky, veřejné osvětlení nebo vodovod a kanalizaci. Obec musí mít tyto sítě zapsané v DTM. Může však správu smluvně přenést na provozovatele (např. VaK). Staré sítě předá ve zjednodušeném režimu, nové stavby už musí nechat přesně zaměřit geodetem.",
      keyRules: [
        "Registrace: Obec musí být zapsána v registru subjektů IS DMVS a mít vymezené své Části DTI.",
        "Pověření provozovatele: Obec může smluvně pověřit správou a předáváním dat DTI specializovanou firmu (např. vodárenskou společnost).",
        "Historická data: Staré pasporty sítí se předávají ve zjednodušeném vedení (NeuplnaData = 1). Není nutné kopat do země!",
        "Nové investice: U každé nové stavby nebo opravy musí obec od stavebníka vyžadovat DSPS v JVF DTM ověřenou ÚOZI.",
        "Sankce a rizika: Pokud obec sítě do DTM nepředá, stavebníci o nich nebudou vědět a hrozí jejich překopnutí při budoucích výkopech bez nároku na náhradu škody!"
      ],
      legalInfo: {
        act: "Stanovisko MPS DTM č. 16 (Přebírání podkladů od obcí jako vlastníků TI) • Zákon č. 200/1994 Sb., § 4b",
        paragraphs: "Obce mají povinnost předat údaje o své infrastruktuře. Mohou však správcovstvím pověřit provozovatele (vodárny, VaK).",
        jvfElement: "SubjektDTI: Obec (Vlastnik), Provozovatel (Editor)",
        attributes: "ICObce, RegistraceDMVS, SmluvniPovereniProvozovatele, ZjednodusenePredaniHistorickychDat"
      },
      tags: ["METODIKA", "Obce", "VaK", "Samospráva", "Pasporty", "Zákon 47/2020"],
      dtmWikiUrl: "https://dtmwiki.cuzk.gov.cz/start",
      svgDiagram: "diagram-networks-corridor"
    }
  ],

  // Časté chyby
  commonMistakes: [
    {
      code: "ERR-01",
      bad: "Překrývání obvodů pozemních komunikací (OPK) v křižovatce.",
      good: "Plocha komunikace nižší třídy se usekne v počátku zakružovacího oblouku; komunikace vyšší třídy probíhá celistvě. Plochy se nikdy nepřekrývají v jedné úrovni.",
      category: "DI",
      impact: "Kritická topologická chyba – odmítnutí importu validačním systémem IS DMVS."
    },
    {
      code: "ERR-02",
      bad: "Zadání silnice na mostě ve stejné úrovni (LEVEL = 0) jako silnice pod mostem.",
      good: "Objekty na mostě musí mít LEVEL = 1, úsek pod mostem má LEVEL = 0. Silnice se na mostních opěrách rozdělí.",
      category: "DI",
      impact: "Neplatná prostorová kolize dvou komunikací ve stejném bodě."
    },
    {
      code: "ERR-03",
      bad: "Snaha zakreslit každé jednotlivé optické vlákno uvnitř optického kabelu.",
      good: "V DTM se kreslí výhradně trasa chráničky / fyzického kabelu. Jednotlivá vlákna se do DTM neuvádějí.",
      category: "TI",
      impact: "Extrémní zahlcení datového modelu neplatnou geometrií; odporuje standardu MPS DTM."
    },
    {
      code: "ERR-04",
      bad: "Vedení trasy kanalizace mezi šachtami ve 3. třídě přesnosti, i když nikdo neví, kudy v areálu vede.",
      good: "Použijte 9. třídu přesnosti pro polohu neznámé linie, do zprávy uveďte 'měření po záhozu', a 3. třídu ponechte pouze pro zaměřené šachty a dna.",
      category: "TI",
      impact: "Uvedení nepravdivých údajů o garanci polohové odchylky; právní odpovědnost ÚOZI."
    },
    {
      code: "ERR-05",
      bad: "Sloučení silnoproudého a optického vedení na společných sloupech do jediné sdružené linie.",
      good: "Vytvořte dvě samostatné linie se stejnými lomovými body sloupů – jednu pro elektro NN, druhou pro optickou síť, obě s LEVEL = 1.",
      category: "TI",
      impact: "Nemožnost správného přiřazení atributů a správy dat jednotlivými provozovateli."
    },
    {
      code: "ERR-06",
      bad: "Odevzdání dat bez kontroly na validačním portálu ČÚZK.",
      good: "Vždy nejprve spusťte kontrolu JVF DTM přes integrační rozhraní IS DMVS. Vyhnete se zamítnutí zakázky krajem.",
      category: "METODIKA",
      impact: "Zbytečná zdržení zakázky a nutnost opakovaného schvalování."
    }
  ],

  // Rádce
  decisionGuide: [
    {
      id: "dec-crossroad-levels",
      code: "SIT-01",
      question: "Měřím křižovatku silnice II. třídy a III. třídy. Která silnice má přednost?",
      tag: "DI • Křižovatky",
      solution: [
        "1. Silnice II. třídy má vyšší prioritu: její polygon Obvodu pozemní komunikace (OPK) zůstane nepřerušený a celistvý.",
        "2. Silnice III. třídy se usekne přesně na hranici zakružovacího oblouku napojení dle vyhlášky 104/1997 Sb.",
        "3. Žádné plochy se nesmí v LEVEL = 0 překrývat ani mezi nimi nesmí vzniknout mezera."
      ]
    },
    {
      id: "dec-bridge-boundary",
      code: "SIT-02",
      question: "Kde přesně končí obvod mostu a jak naložit se svodidly a zábradlím?",
      tag: "DI • Mosty",
      solution: [
        "1. Do obvodu mostu zahrňte opěry, mostní křídla, mostovku, římsy a svodidla i zábradlí, která jsou přímo na mostě připevněná.",
        "2. Navazující silniční zábradlí a svodidla mimo mostní těleso už do obvodu mostu nepatří (patří do běžného OPK silnice).",
        "3. Silnice na mostě dostane LEVEL = 1, zatímco terén nebo voda pod mostem má LEVEL = 0."
      ]
    },
    {
      id: "dec-sewer-campus",
      code: "SIT-03",
      question: "Zaměřuji kanalizaci v uzavřeném areálu a neznám přesný průběh potrubí mezi šachtami",
      tag: "TI • Kanalizace",
      solution: [
        "1. Vstupní šachty zaměřte přesně ve 3. třídě přesnosti (poloha poklopu i výška dna).",
        "2. Spojovací linii mezi šachtami zadejte v 9. třídě přesnosti (přesnost nezjištěna).",
        "3. Způsob pořízení označte jako 'měření po záhozu'.",
        "4. V technické zprávě podrobně popište, že trasa je odvozena pouze ze spojnic šachet bez odkrytí výkopu."
      ]
    },
    {
      id: "dec-village-passport",
      code: "SIT-04",
      question: "Jsem starosta obce a máme starý papírový pasport vodovodu. Musíme vše nechat vykopat?",
      tag: "TI • Obce a VaK",
      solution: [
        "1. NEMUSÍTE kopat ani znovu geodeticky měřit existující staré sítě!",
        "2. Využijte zákonný režim 'Zjednodušené vedení údajů' s příznakem NeuplnaData = 1.",
        "3. Stačí digitalizovat přibližný průběh ze stávajícího pasportu, uvést druh sítě, obec jako vlastníka a orientační polohu.",
        "4. Pouze nové stavby a rekonstrukce se již musí měřit geodetem před záhozem ve 3. nebo 1. třídě přesnosti."
      ]
    },
    {
      id: "dec-cables-on-poles",
      code: "SIT-05",
      question: "Po stejných betonových sloupech vede elektřina NN i optický kabel. Jak to vymodelovat?",
      tag: "TI • Nadzemní vedení",
      solution: [
        "1. Podpěrné body (sloupy) se zaměří na terénu v LEVEL = 0.",
        "2. Vytvořte dvě samostatné linie: jednu pro silové vedení NN, druhou pro elektronické komunikace.",
        "3. Obě linie budou mít shodnou geometrii procházející zaměřenými sloupy a obě budou mít atribut LEVEL = 1."
      ]
    }
  ],

  // Kvíz
  quiz: [
    {
      question: "Jakou hodnotu atributu LEVEL má pozemní komunikace vedená po mostě?",
      options: [
        "LEVEL = 0",
        "LEVEL = 1",
        "LEVEL = -1",
        "LEVEL = 9"
      ],
      correct: 1,
      explanation: "Komunikace na mostě je nadzemní stavba, proto se značí LEVEL = 1. Silnice na zemském povrchu má LEVEL = 0, tunel LEVEL = -1."
    },
    {
      question: "Jaká je základní požadovaná třída přesnosti pro úplnou evidenci polohy sítí DTI (NeuplnaData = 0)?",
      options: [
        "Alespoň 1. třída (m_xy ≤ 0,04 m)",
        "Alespoň 3. třída (m_xy ≤ 0,14 m)",
        "Alespoň 5. třída (m_xy ≤ 0,50 m)",
        "9. třída (nezjištěna)"
      ],
      correct: 1,
      explanation: "Podle vyhlášky č. 393/2020 Sb. musí data pro úplnou evidenci dosahovat alespoň 3. třídy přesnosti (polohová odchylka m_xy do 14 cm)."
    },
    {
      question: "Která komunikace má v křižovatce přednost při vymezení celistvého polygonu OPK?",
      options: [
        "Vždy ta, která má v daném místě větší šířku asfaltu",
        "Silnice vyšší třídy (např. II. třída před III. třídou)",
        "Vždy silnice s vyšším evidenčním číslem",
        "Obě silnice se v křižovatce překrývají a vzniká společný průnik"
      ],
      correct: 1,
      explanation: "Přednost má vždy komunikace vyšší třídy. Silnice nižší třídy se usekává na počátku zakružovacího oblouku. Plochy se v jedné úrovni nesmí překrývat."
    },
    {
      question: "Mapují se v DTM jednotlivá optická vlákna uvnitř optických kabelů?",
      options: [
        "Ano, každé vlákno musí mít vlastní prostorovou 3D linii",
        "Ne, mapuje se výhradně trasa chráničky nebo vnějšího kabelu",
        "Pouze u státních a krajských páteřních sítí",
        "Pouze pokud je v kabelu více než 48 vláken"
      ],
      correct: 1,
      explanation: "Metodika MPS DTM výslovně stanoví, že jednotlivá vlákna se v DTM neevidují. Mapuje se pouze fyzická trasa trubky/kabelu."
    },
    {
      question: "Jakou třídu přesnosti polohy použijete pro kanalizaci v areálu, kde znáte šachty, ale neznáte přesnou trasu mezi nimi?",
      options: [
        "1. třídu",
        "3. třídu",
        "9. třídu (nezjištěna)",
        "Kanalizace se v takovém případě nesmí do DTM vůbec zakreslit"
      ],
      correct: 2,
      explanation: "Šachty se zaměří ve 3. třídě, ale neznámá spojovací linie mezi nimi se vede v 9. třídě přesnosti s poznámkou 'měření po záhozu'."
    }
  ]
};
