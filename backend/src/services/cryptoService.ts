import crypto from 'crypto'
import { config } from '../config'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getKey(): Buffer {
  return crypto.createHash('sha256').update(config.security.encryptionSecret).digest()
}

export function encryptText(value: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decryptText(value: string): string {
  const [ivBase64, authTagBase64, encryptedBase64] = value.split(':')

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error('Valore cifrato non valido')
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivBase64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

export function hashToken(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}
