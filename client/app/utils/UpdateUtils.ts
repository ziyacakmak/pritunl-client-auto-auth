/// <reference path="../References.d.ts"/>
import * as Request from "../Request"

export interface Version {
	label: string
	version: string
	revision: number
}

export interface Update {
	current: Version
	latest: Version
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

			return {
				current: current,
				latest: latest,
			}
		}, (): null => {
			return null
		})
}
