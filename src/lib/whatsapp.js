// Lien WhatsApp d'un numéro (Responsable de flottes, C8) : un clic ouvre la
// conversation. Numéro sénégalais sans indicatif → +221.
export function whatsappLink(phone) {
  let digits = String(phone ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 9) digits = `221${digits}`
  return `https://wa.me/${digits}`
}
