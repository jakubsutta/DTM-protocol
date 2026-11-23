/**
 * Konstanty a URL endpointy pro aplikaci Info o obci.
 */
var CityInfo = window.CityInfo || {};

CityInfo.Config = {
  RUIAN: "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer",
  LAYER: { OBEC: 12, POU: 13, ORP: 14, OKRES: 15, KRAJ: 17 },
  ORTOFOTO_WMS: "https://ags.cuzk.gov.cz/arcgis1/services/ORTOFOTO/MapServer/WMSServer",
  ARES_SEARCH: "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat",
  RISY_WEBY_OBCI: "https://egis.uur.cz/arcgis/rest/services/RISY/weby_obci/MapServer/0"
};
