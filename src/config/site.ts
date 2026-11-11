export const SITE_CONFIG = {
  SITE_NAME: (typeof process !== 'undefined' && process.env?.SITE_NAME) || '360Khabarnama',
  URDU_NAME: '360 خبرنامہ',
  SITE_URL: (typeof process !== 'undefined' && process.env?.SITE_URL) || 'https://360khabarnama.com',
  ADMIN_URL: (typeof process !== 'undefined' && process.env?.ADMIN_URL) || 'https://admin.360khabarnama.com',
  TAGLINE_EN: 'Your Complete World of News & Information.',
  TAGLINE_UR: 'Har Khabar. Har Maloomat. Ek Jagah.',
  LOGO_PATH: '/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png',
  FAVICON_PATH: '/assets/aistudio/fav_8df1a0eb.png',
};
