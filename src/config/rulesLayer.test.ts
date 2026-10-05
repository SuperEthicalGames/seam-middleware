import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { GAME_BOOTSTRAP_OWNER_EMAIL } from './games'

/**
 * Los tres juegos usan la MISMA capa de administradores (owners / admins / adminRequests). Si un archivo de Rules cambia y los otros no, el
 * portal se comportaría distinto según el juego: esta prueba lo impide.
 */
const read = (name: string) => JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../game-database-rules/${name}.rules.json`), 'utf8')).rules

describe('capa de administradores de las Rules de los juegos', () => {
  const rules = { amazonas: read('amazonas'), cartagena: read('cartagena'), cafetero: read('cafetero') }

  it.each(['owners', 'admins', 'adminRequests'])('%s es idéntico en Amazonas, Cartagena y Cafetero', (node) => {
    expect(rules.amazonas[node]).toBeDefined()
    expect(rules.cartagena[node]).toEqual(rules.cafetero[node])
    expect(rules.amazonas[node]).toEqual(rules.cafetero[node])
  })

  it('solo los propietarios pueden dar de alta administradores y propietarios, y nadie escribe `owners` en bloque', () => {
    expect(rules.cafetero.owners['.write']).toBeUndefined()
    expect(rules.cafetero.admins.$uid['.write']).toContain("root.child('owners')")
    expect(rules.cafetero.owners.$uid['.write']).toContain("root.child('owners')")
  })

  it('el correo raíz de las Rules es el mismo que usa el portal, en los tres juegos', () => {
    for (const game of Object.values(rules)) {
      expect(game.owners.$uid['.write']).toContain(`auth.token.email === '${GAME_BOOTSTRAP_OWNER_EMAIL}'`)
      expect(game.owners.$uid['.write']).toContain('auth.token.email_verified === true')
    }
  })
})
