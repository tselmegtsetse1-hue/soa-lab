/**
 * Lab 07 — Droplet (public IP). Local-д ажиллуулахдаа эдгээрийг localhost болгож солино.
 * Анхаар: HTTPS static site (жишээ DO App Platform)-аас HTTP API руу хандахад хөтөч блоклож болно.
 */
window.SOA_CONFIG = {
  GATEWAY_URL: 'http://127.0.0.1:5000'
};

  // Шууд сервис рүү холболт (Lab 07 compatible fallback)
  JSON_API_URL: 'http://167.172.84.93:3000',
  SOAP_PROXY_URL: 'http://167.172.84.93:4000',
  FILE_API_URL: 'http://167.172.84.93:3001'
};
