import { describe, expect, it } from 'vitest'
import { formatCedula, isValidCedula, normalizeCedula } from './cedula'

describe('cédula venezolana', () => {
  it('normaliza entradas con prefijo y puntos', () => {
    expect(normalizeCedula('V-12.345.678')).toBe('12345678')
    expect(formatCedula('12345678')).toBe('12.345.678')
  })

  it('valida entre cinco y ocho dígitos', () => {
    expect(isValidCedula('12345')).toBe(true)
    expect(isValidCedula('12345678')).toBe(true)
    expect(isValidCedula('1234')).toBe(false)
  })
})
