import sanitizeHtml from 'sanitize-html'

const allowedTags = ['p', 'h2', 'h3', 'h4', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'br']

const allowedAttributes: Record<string, string[]> = {
  a: ['href'],
  img: ['src', 'alt'],
}

export function sanitizeBody(html: string): string {
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ['http', 'https'],
  })
}

export function extractPlainText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  }).replace(/\s+/g, ' ').trim()
}
