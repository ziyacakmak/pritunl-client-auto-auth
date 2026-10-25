/// <reference path="../References.d.ts"/>
import crypto from "crypto"

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

export function normalizeSecret(secret: string): string {
	if (!secret) {
		return ""
	}

	secret = secret.toUpperCase()
	secret = secret.replace(/[\s\-_=]/g, "")

	return secret
}

export function isValidSecret(secret: string): boolean {
	secret = normalizeSecret(secret)

	if (secret.length < 16 || secret.length > 128) {
		return false
	}

	return /^[A-Z2-7]+$/.test(secret)
}

function base32Decode(secret: string): Buffer {
	secret = normalizeSecret(secret)

	let bits = 0
	let value = 0
	let output: number[] = []

	for (let i = 0; i < secret.length; i++) {
		let idx = base32Alphabet.indexOf(secret.charAt(i))

		if (idx === -1) {
			throw new Error("Geçersiz base32 anahtarı")
		}

		value = (value << 5) | idx
		bits += 5

		if (bits >= 8) {
			output.push((value >>> (bits - 8)) & 0xff)
			bits -= 8
		}
	}

	return Buffer.from(output)
}

export function generateCode(secret: string, time?: number): string {
	let counter = Math.floor((time || Date.now()) / 1000 / 30)

	let buf = Buffer.alloc(8)
	buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
	buf.writeUInt32BE(counter % 0x100000000, 4)

	let hmac = crypto.createHmac("sha1", base32Decode(secret))
	hmac.update(buf)
	let digest = hmac.digest()

	let offset = digest[digest.length - 1] & 0x0f
	let code = ((digest[offset] & 0x7f) << 24) |
		((digest[offset + 1] & 0xff) << 16) |
		((digest[offset + 2] & 0xff) << 8) |
		(digest[offset + 3] & 0xff)

	return (code % 1000000).toString().padStart(6, "0")
}

export function secondsRemaining(time?: number): number {
	return 30 - (Math.floor((time || Date.now()) / 1000) % 30)
}
