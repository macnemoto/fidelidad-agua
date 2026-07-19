export function normalizeCedula(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8)
}

export function formatCedula(value: string): string {
  const digits = normalizeCedula(value)
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function isValidCedula(value: string): boolean {
  const length = normalizeCedula(value).length
  return length >= 5 && length <= 8
}
