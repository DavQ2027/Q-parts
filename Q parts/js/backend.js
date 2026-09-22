import { firebaseConfig } from './firebase-config.js';

let connection;
// Una sola instancia de Firebase. La navegación se carga incluso si la red falla.
export function getBackend() {
  if (!connection) connection = Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js')
  ]).then(([appSDK, authSDK, databaseSDK]) => {
    const app = appSDK.getApps().length ? appSDK.getApp() : appSDK.initializeApp(firebaseConfig);
    return { ...authSDK, ...databaseSDK, auth: authSDK.getAuth(app), db: databaseSDK.getDatabase(app) };
  }).catch(error => { connection = null; throw error; });
  return connection;
}
