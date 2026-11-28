// Contacts DEM — mêmes valeurs que l'app (core/config/app_config.dart)
// Appel : 71 006 46 64 — WhatsApp (assistant) : 71 013 19 26.
export const SUPPORT = {
  phone: '+221710064664',
  phoneDisplay: '+221 71 006 46 64',
  whatsapp: '221710131926',
  whatsappDisplay: '+221 71 013 19 26',
  email: 'support@dem.sn',
  website: 'https://www.dem.sn',
  websiteDisplay: 'www.dem.sn',
  terms: 'https://www.dem.sn/terms',
  privacy: 'https://www.dem.sn/privacy',
  apiDocs: 'https://www.dem.sn/developpeurs',
  connectSite: 'https://www.dem.sn/brancher',
}

export const whatsappUrl = (text) => `https://wa.me/${SUPPORT.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`
