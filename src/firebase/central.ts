import { initializeApp } from 'firebase/app'
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
export const centralAuth = getAuth(centralApp)
export const centralDb = getDatabase(centralApp)
