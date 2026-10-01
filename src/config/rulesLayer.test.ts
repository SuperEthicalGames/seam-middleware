import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

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

  it('solo los propietarios (que se crean en la consola) pueden dar de alta administradores', () => {
    expect(rules.cafetero.owners['.write']).toBe(false)
    expect(rules.cafetero.admins.$uid['.write']).toContain("root.child('owners')")
  })
})
