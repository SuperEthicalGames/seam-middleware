import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth'
import { firebaseConfig } from './central'

/**
 * `createUserWithEmailAndPassword` en el SDK de cliente cierra la sesión actual y la
 * reemplaza por la de la cuenta recién creada — si el admin principal la llamara
 * directamente sobre `centralAuth`, se desloguearía a sí mismo al crear a alguien más.
 * Se crea una instancia de Firebase App completamente aparte (mismo proyecto, mismo
 * `firebaseConfig`, pero un `Auth` propio) solo para este momento, y se destruye al
 * terminar — la sesión real del admin principal en `centralAuth` nunca se toca.
 */
export async function createAdminAuthAccount(email: string): Promise<{ uid: string }> {
  const secondaryApp = initializeApp(firebaseConfig, `admin-creation-${Date.now()}`)
  const secondaryAuth = getAuth(secondaryApp)
  try {
    // Contraseña descartada de inmediato — la cuenta nueva la define ella misma vía el
    // correo de restablecimiento enviado abajo. Nadie más llega a conocerla.
    const tempPassword = crypto.randomUUID()
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword)
    await sendPasswordResetEmail(secondaryAuth, email)
    await signOut(secondaryAuth)
    return { uid: credential.user.uid }
  } finally {
    await deleteApp(secondaryApp)
  }
}
