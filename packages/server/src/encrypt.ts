import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// 加载 .env 文件 (不依赖 dotenv 包)
{
  const envPath = join(__dirname, '../../.env')
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#'))
        continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1)
        continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

export function computeMD5(str: string, salt = ''): string {
  if (!str)
    return ''
  try {
    const hash = createHash('md5')
    hash.update(str + salt)
    return hash.digest('hex')
  }
  catch (error) {
    console.error('MD5 计算失败:', error)
    return ''
  }
}

export function randomBase64String() {
  return randomBytes(16).toString('base64')
}

export function aesEcbEncrypt(plaintext: string, key: string, salt = ''): string {
  if (!plaintext)
    return ''
  const keyBuffer = Buffer.from(key, 'utf8')
  if (![16, 24, 32].includes(keyBuffer.length)) {
    throw new Error('Invalid key length. Key must be 16, 24 or 32 bytes.')
  }
  const plaintextBuffer = Buffer.from(plaintext, 'utf8')
  const cipher = createCipheriv(`aes-${keyBuffer.length * 8}-ecb`, keyBuffer, null)
  cipher.setAutoPadding(true)
  const encrypted = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()])

  if (salt) {
    const encryptedHex = encrypted.toString('hex')
    const saltedData = encryptedHex + salt
    const md5Hash = createHash('md5').update(saltedData).digest('hex')
    return md5Hash + encryptedHex
  }
  return encrypted.toString('hex')
}

export function aesEcbDecrypt(encryptedData: string, key: string): string {
  const keyBuffer = Buffer.from(key, 'utf8')
  if (![16, 24, 32].includes(keyBuffer.length)) {
    throw new Error('Invalid key length. Key must be 16, 24 or 32 bytes.')
  }
  const encryptedBuffer = Buffer.from(encryptedData.slice(32), 'hex')
  if (encryptedBuffer.length % 16 !== 0) {
    throw new Error(`Invalid data length (${encryptedBuffer.length} bytes). Data length must be a multiple of 16 bytes.`)
  }
  const decipher = createDecipheriv(`aes-${keyBuffer.length * 8}-ecb`, keyBuffer, null)
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()])
  return decrypted.toString('utf8')
}

// 配置区
export const CONFIG = {
  uid: '',
  token: '',
  host: 'minesweeper.natapp1.cc',
  key: process.env.ENCRYPT_KEY || '',
  salt: process.env.ENCRYPT_SALT || '',
}

export function decryptAESECB(encryptedData: string): string {
  return aesEcbDecrypt(encryptedData, CONFIG.key)
}

export function encryptAESECB(plaintext: string): string {
  return aesEcbEncrypt(plaintext, CONFIG.key, CONFIG.salt)
}

export const LOGIN_CONFIG = {
  id: '',
  password: '',
  uid: '',
  token: '',
  encryptSecretKey: process.env.ENCRYPT_SECRET_KEY || '',
  decryptSecretKey: process.env.DECRYPT_SECRET_KEY || '',
  host: 'minesweeper.natapp1.cc',
}

export async function executeRequest<T>(path: string, method: string, params: Record<string, any>): Promise<T> {
  const data = new URLSearchParams(params).toString()
  let body = aesEcbEncrypt(data, LOGIN_CONFIG.encryptSecretKey)
  if (data === '{}') {
    body = ''
  }
  const timeStamp = Date.now().toString()
  const apiKey = makeApiKey(body, timeStamp)
  const headers: any = {
    'device': 'OPD2413',
    'version': '30610',
    'channel': 'App',
    'language': 'zh',
    'token': CONFIG.token,
    'uid': CONFIG.uid,
    'Host': 'minesweeper.natapp1.cc',
    'Connection': 'Keep-Alive',
    'Accept-Encoding': 'gzip',
    'User-Agent': 'okhttp/4.7.2',
    'time-stamp': timeStamp,
    'api-key': apiKey,
    'Content-Length': body.length.toString(),
    'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
  }

  try {
    const response = await fetch(`http://${headers.Host}${path}`, {
      method,
      headers,
      body,
    })
    const cipher = await response.text()
    const jsonStr = aesEcbDecrypt(cipher, LOGIN_CONFIG.decryptSecretKey) as string
    const json = JSON.parse(jsonStr)
    return json as T
  }
  catch (error) {
    console.error('获取游戏资讯失败:', error)
    throw error
  }
}

function makeApiKey(body: string, timeStamp: string = Date.now().toString()): string {
  return computeMD5(`${LOGIN_CONFIG.uid + LOGIN_CONFIG.token + timeStamp + computeMD5(body)}api`)
}
