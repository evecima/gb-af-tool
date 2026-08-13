APARTMENT FINDER v2.0

FILES
- index.html              Main application
- apartments.js           Editable apartment/building database used by the app
- apartments_master_v1.csv Human-readable master database
- app.js                  Search and interface logic
- styles.css              Mobile interface
- manifest.webmanifest    PWA installation metadata
- service-worker.js       Offline cache
- icons/                   App icons
- VALIDATION.txt          Database validation record

LOCAL TEST
Extract the ZIP and open index.html in a browser.
Apartment and building lookup will work immediately.

PWA / OFFLINE INSTALLATION
The service worker and true PWA installation activate after the folder is hosted
over HTTPS (or localhost). The application is already prepared for that step.

DATABASE EDITING
The active lookup data is isolated in apartments.js.
Future database changes do not require rewriting the interface or search logic.

PRIVACY / DISCOVERY
- index.html includes noindex/nofollow/noarchive metadata.
- robots.txt asks web crawlers not to index the site.
- These measures reduce accidental discovery but do not make a public GitHub Pages site private.
