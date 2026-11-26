/// <reference path="../References.d.ts"/>
import * as Request from "../Request"

export interface Version {
	label: string
	version: string
	revision: number
}

export interface Asset {
	name: string
	url: string
	size: number
	sha256: string
}

export interface Update {
	current: Version
	latest: Version
	asset: Asset | null
	installable: boolean
}

function parseVersion(label: string): Version | null {
	if (!label) {
		return null
	}

	label = label.trim()

	let match = label.replace(/^v/i, "").match(
		/^(\d+(?:\.\d+)*)(?:-auto-auth\.(\d+))?$/i)
	if (!match) {
		return null
	}

	return {
		label: label,
		version: match[1],
		revision: match[2] ? parseInt(match[2], 10) : 0,
	}
}

function compareBaseVersion(left: string, right: string): number {
	let leftParts = left.split(".")
	let rightParts = right.split(".")
	let length = Math.max(leftParts.length, rightParts.length)

	for (let i = 0; i < length; i++) {
		let leftPart = parseInt(leftParts[i] || "0", 10)
		let rightPart = parseInt(rightParts[i] || "0", 10)

		if (leftPart !== rightPart) {
			return leftPart > rightPart ? 1 : -1
		}
	}

	return 0
}

function parseDigest(digest: any): string {
	let match = String(digest || "").trim().match(/^sha256:([a-f0-9]{64})$/i)
	return match ? match[1].toLowerCase() : ""
}

function installableAsset(name: string): boolean {
	if (process.platform === "darwin") {
		return /macos/i.test(name) && /\.zip$/i.test(name)
	}

	if (process.platform === "win32") {
		return /setup\.exe$/i.test(name)
	}

	return false
}

function selectAsset(assets: any): Asset | null {
	if (!Array.isArray(assets)) {
		return null
	}

	for (let item of assets) {
		if (!item) {
			continue
		}

		let name = String(item.name || "")
		let url = String(item.browser_download_url || "")

		if (!name || !url || !installableAsset(name)) {
			continue
		}

		return {
			name: name,
			url: url,
			size: Number(item.size) || 0,
			sha256: parseDigest(item.digest),
		}
	}

	return null
}

function autoInstallSupported(): boolean {
	if (process.platform === "win32") {
		return true
	}

	return process.platform === "darwin" && process.arch === "arm64"
}

export function getCurrentVersion(): Version | null {
	return parseVersion(__RELEASE_TAG__) || parseVersion(__APP_VERSION__)
}

export function check(): Promise<Update | null> {
	let current = getCurrentVersion()
	if (!current) {
		return Promise.resolve(null)
	}

	return new Request.Request()
		.tcp("https://api.github.com")
		.timeout(15)
		.get("/repos/ziyacakmak/pritunl-client-auto-auth/releases/latest")
		.set("Accept", "application/vnd.github+json")
		.set("User-Agent", "pritunl-auto-auth")
		.end()
		.then((resp: Request.Response): Update | null => {
			if (resp.status !== 200) {
				return null
			}

			let data = resp.jsonPassive()
			if (!data || data.draft || data.prerelease) {
				return null
			}

			let latest = parseVersion(data.tag_name)
			if (!latest) {
				return null
			}

			let baseDiff = compareBaseVersion(
				latest.version, current.version)
			if (baseDiff < 0 ||
				(baseDiff === 0 && latest.revision <= current.revision)) {
				return null
			}

			let asset = selectAsset(data.assets)

			return {
				current: current,
				latest: latest,
				asset: asset,
				installable: !!asset && autoInstallSupported(),
			}
		}, (): null => {
			return null
		})
}
