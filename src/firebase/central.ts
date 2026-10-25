import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

// Firebase del PORTAL (backend central). NO confundir con los Firebase de los juegos.
// Exportado (no solo local) porque adminCreation.ts necesita esta misma config para
// levantar una segunda instancia de Firebase App — ver ese archivo para el porqué.
export const firebaseConfig = {
  apiKey: 'AIzaSyAc1DWrW3EKirN9ym7vI-MROEceiKARSTo',
  authDomain: 'seam-middleware.firebaseapp.com',
  databaseURL: 'https://seam-middleware-default-rtdb.firebaseio.com',
  projectId: 'seam-middleware',
  storageBucket: 'seam-middleware.firebasestorage.app',
  messagingSenderId: '447034645032',
  appId: '1:447034645032:web:5da1bf806b164d5309f31d',
  measurementId: 'G-JKXP5Q73L8',
}

export const centralApp = initializeApp(firebaseConfig, 'central')

/**
 * Clave del SITIO de reCAPTCHA Enterprise (Fraud Defense) para App Check (es pública, como la `apiKey`; reCAPTCHA Enterprise no tiene clave secreta que guardar
 * en Firebase: en App Check → Apps → SEAM Middleware solo se registra esta misma clave). Con reCAPTCHA v3 clásico la clave SECRETA sí viviría solo en la consola
 * de Firebase y nunca en este repositorio. Vacía = App Check no se inicia y el portal funciona exactamente como antes.
 *
 * Orden para activarlo sin dejar a nadie afuera: 1) crear la clave de Fraud Defense / reCAPTCHA Enterprise para web (dominios `superethicalgames.github.io` y
 * `localhost`) en el MISMO proyecto de Google Cloud que la app de Firebase (`seam-middleware`) y con la API de reCAPTCHA Enterprise habilitada: si no, el
 * intercambio del token falla con 400 "site key is from the same project as the one containing this app"; 2) registrar la app web en App Check con esa clave; 3) pegar aquí la clave del sitio y desplegar; 4) mirar en App Check → APIs que casi
 * todas las solicitudes a Realtime Database llegan "verificadas"; 5) solo entonces pulsar "Aplicar" en Realtime Database. Si se aplica antes del paso 3–4,
 * el portal deja de poder leer su base.
 * No se aplica en Authentication: `adminCreation.ts` crea cuentas con una segunda instancia de la app que no lleva App Check.
 */
export const APP_CHECK_SITE_KEY = '6LfgdQAuAAAAAAVL7_DcENHZ2sBiuXxqfCZn33nu'
/** 'enterprise' = Fraud Defense (reCAPTCHA Enterprise, el que Google ya recomienda: reCAPTCHA Classic figura como obsoleto); 'v3' = reCAPTCHA v3 clásico. Debe coincidir con el proveedor registrado en App Check. */
export const APP_CHECK_PROVIDER: 'enterprise' | 'v3' = 'enterprise'

if (APP_CHECK_SITE_KEY) {
  // En desarrollo local (localhost) el navegador imprime un token de depuración en la consola que hay que registrar en App Check → Apps → Administrar tokens de depuración.
  if (import.meta.env.DEV) (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true
  initializeAppCheck(centralApp, {
    provider: APP_CHECK_PROVIDER === 'enterprise' ? new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY) : new ReCaptchaV3Provider(APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  })
}
export const centralAuth = getAuth(centralApp)
export const centralDb = getDatabase(centralApp)
