import childProcess from "child_process"
import crypto from "crypto"
import fs from "fs"
import path from "path"
import process from "process"
import electron from "electron"
import * as Constants from "./Constants"
import * as Errors from "./Errors"
import * as Logger from "./Logger"

export interface Asset {
	name: string
	url: string
	size: number
	sha256: string
}

export interface Target {
	tag: string
	asset: Asset
}

export type Phase = "idle" | "downloading" | "verifying" | "downloaded" |
	"installing" | "error"

export interface State {
	phase: Phase
	tag: string
	percent: number
	received: number
	total: number
	message: string
	ready: boolean
}

interface Pending {
	tag: string
	file: string
	size: number
	sha256: string
}

const allowedHosts = [
	"github.com",
	"objects.githubusercontent.com",
	"api.github.com",
	"codeload.github.com",
]

let state: State = emptyState()
let request: electron.ClientRequest | null = null
let running = false
let aborted = false

function emptyState(): State {
	return {
		phase: "idle",
		tag: "",
		percent: 0,
		received: 0,
		total: 0,
		message: "",
		ready: false,
	}
}

export function getState(): State {
	return state
}

function emit(): void {
	if (Constants.mainWindow && !Constants.mainWindow.isDestroyed()) {
		Constants.mainWindow.webContents.send("event.update-state", state)
	}
}

function setState(next: Partial<State>): void {
	state = Object.assign({}, state, next) as State
	emit()
}

function fail(message: string, err?: Error): [string | null, State] {
	if (err) {
		Logger.error(new Errors.ProcessError(err, message))
	}
	setState({
		phase: "error",
		percent: 0,
		message: message,
		ready: false,
	})
	return [message, state]
}

function validUrl(url: string): boolean {
	try {
		let parsed = new URL(url)
		return parsed.protocol === "https:" &&
			allowedHosts.indexOf(parsed.hostname) !== -1
	} catch (err) {
		return false
	}
}

function sanitize(name: string): string {
	return String(name || "").replace(/[^A-Za-z0-9._-]/g, "_")
}

function targetDir(target: Target): string {
	return path.join(electron.app.getPath("temp"), "pritunl-update",
		sanitize(target && target.tag))
}

function targetFile(target: Target): string {
	return path.join(targetDir(target),
		sanitize(target.asset && target.asset.name))
}

function pendingFile(target: Target): string {
	return path.join(targetDir(target), "pending.json")
}

function resultFile(target: Target): string {
	return path.join(targetDir(target), "rc.txt")
}

function removeFile(pth: string): void {
	try {
		fs.unlinkSync(pth)
	} catch (err) {}
}

function removeDir(pth: string): void {
	try {
		fs.rmSync(pth, {recursive: true, force: true})
	} catch (err) {}
}

function isWritable(pth: string): boolean {
	try {
		fs.accessSync(pth, fs.constants.W_OK)
		return true
	} catch (err) {
		return false
	}
}

function readPending(target: Target): Pending | null {
	try {
		let data = JSON.parse(fs.readFileSync(pendingFile(target), "utf8"))
		if (!data || !data.tag || !data.sha256) {
			return null
		}
		return data as Pending
	} catch (err) {
		return null
	}
}

function writePending(target: Target, pending: Pending): void {
	try {
		fs.writeFileSync(pendingFile(target), JSON.stringify(pending))
	} catch (err) {
		Logger.error(new Errors.WriteError(err,
			"Güncelleme: Bekleyen güncelleme yazılamadı",
			{path: pendingFile(target)}))
	}
}

function clearPending(target: Target): void {
	removeFile(pendingFile(target))
}

function execFile(file: string, args: string[]):
		Promise<{ok: boolean, stdout: string, stderr: string}> {

	return new Promise((resolve): void => {
		childProcess.execFile(file, args, {timeout: 180000},
			(err, stdout, stderr): void => {
				resolve({
					ok: !err,
					stdout: String(stdout || ""),
					stderr: String(stderr || ""),
				})
			})
	})
}

function fetchToFile(url: string, filePath: string,
		onProgress: (received: number, total: number) => void):
		Promise<{size: number, sha256: string}> {

	return new Promise((resolve, reject): void => {
		let settled = false

		let fail = (err: Error): void => {
			if (settled) {
				return
			}
			settled = true
			request = null
			reject(err)
		}

		let req = electron.net.request(url)
		request = req

		req.on("error", (err: Error): void => {
			fail(err)
		})

		req.on("abort", (): void => {
			fail(new Error("aborted"))
		})

		req.on("response", (resp: electron.IncomingMessage): void => {
			if (resp.statusCode !== 200) {
				resp.on("data", (): void => {})
				fail(new Error("HTTP " + resp.statusCode))
				return
			}

			let total = parseInt(
				String(resp.headers["content-length"] || "0"), 10) || 0
			let hash = crypto.createHash("sha256")
			let file = fs.createWriteStream(filePath)
			let received = 0
			let failed = false

			file.on("error", (err: Error): void => {
				failed = true
				fail(err)
			})

			resp.on("data", (chunk: Buffer): void => {
				if (failed) {
					return
				}
				received += chunk.length
				hash.update(chunk)
				if (!file.write(chunk)) {
					let stream = resp as any
					stream.pause()
					file.once("drain", (): void => {
						stream.resume()
					})
				}
				onProgress(received, total)
			})

			resp.on("error", (err: Error): void => {
				failed = true
				fail(err)
			})

			resp.on("end", (): void => {
				if (failed) {
					return
				}
				file.end((): void => {
					if (settled) {
						return
					}
					settled = true
					request = null
					resolve({
						size: received,
						sha256: hash.digest("hex"),
					})
				})
			})
		})

		req.end()
	})
}

function fetchText(url: string): Promise<string> {
	return new Promise((resolve, reject): void => {
		let req = electron.net.request(url)

		req.on("error", (err: Error): void => {
			reject(err)
		})

		req.on("response", (resp: electron.IncomingMessage): void => {
			let data = ""

			if (resp.statusCode !== 200) {
				resp.on("data", (): void => {})
				reject(new Error("HTTP " + resp.statusCode))
				return
			}

			resp.on("data", (chunk: Buffer): void => {
				data += chunk.toString("utf8")
			})

			resp.on("end", (): void => {
				resolve(data)
			})
		})

		req.end()
	})
}

async function expectedSha(target: Target): Promise<string> {
	if (target.asset.sha256) {
		return target.asset.sha256
	}

	let idx = target.asset.url.lastIndexOf("/")
	if (idx < 0) {
		return ""
	}

	let sums = await fetchText(
		target.asset.url.slice(0, idx + 1) + "SHA256SUMS.txt")

	for (let line of sums.split("\n")) {
		let parts = line.trim().split(/\s+/)
		if (parts.length >= 2 &&
				parts[1].replace(/^\*/, "") === target.asset.name) {
			return parts[0].toLowerCase()
		}
	}

	return ""
}

function pollResult(pth: string, timeout: number): Promise<number> {
	let started = Date.now()

	return new Promise((resolve): void => {
		let timer = setInterval((): void => {
			let value: number | null = null

			try {
				let text = fs.readFileSync(pth, "utf8").trim()
				if (text) {
					let parsed = parseInt(text, 10)
					if (!isNaN(parsed)) {
						value = parsed
					}
				}
			} catch (err) {}

			if (value !== null) {
				clearInterval(timer)
				resolve(value)
				return
			}

			if (Date.now() - started > timeout) {
				clearInterval(timer)
				resolve(-1)
			}
		}, 500)
	})
}

export function status(target: Target | null): [string | null, State] {
	if (running) {
		return [null, state]
	}

	if (!target || !target.tag || !target.asset) {
		state = emptyState()
		return [null, state]
	}

	let pending = readPending(target)

	if (pending && pending.tag === target.tag &&
			(!target.asset.sha256 ||
				pending.sha256 === target.asset.sha256) &&
			fs.existsSync(targetFile(target))) {

		state = {
			phase: "downloaded",
			tag: target.tag,
			percent: 100,
			received: pending.size,
			total: pending.size,
			message: "",
			ready: true,
		}

		return [null, state]
	}

	state = Object.assign(emptyState(), {tag: target.tag}) as State

	return [null, state]
}

export function cancel(): void {
	aborted = true

	if (request) {
		try {
			request.abort()
		} catch (err) {}
	}
}

export async function start(target: Target):
		Promise<[string | null, State]> {

	if (running) {
		return ["Güncelleme: Zaten bir indirme sürüyor", state]
	}

	if (!target || !target.tag || !target.asset) {
		return fail("Güncelleme: Güncelleme bilgisi eksik")
	}

	if (!validUrl(target.asset.url)) {
		return fail("Güncelleme: İndirme adresi geçersiz")
	}

	running = true
	aborted = false

	let file = targetFile(target)
	let part = file + ".part"

	try {
		fs.mkdirSync(targetDir(target), {recursive: true})
		removeFile(part)
		removeFile(resultFile(target))
		clearPending(target)

		setState({
			phase: "downloading",
			tag: target.tag,
			percent: 0,
			received: 0,
			total: target.asset.size || 0,
			message: "",
			ready: false,
		})

		let downloaded: {size: number, sha256: string} | null = null
		let lastErr: Error | null = null

		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				downloaded = await fetchToFile(target.asset.url, part,
					(received: number, total: number): void => {
						setState({
							received: received,
							total: total || target.asset.size || 0,
							percent: total ? Math.min(99,
								Math.round(received / total * 100)) : 0,
						})
					})
				lastErr = null
				break
			} catch (err) {
				lastErr = err as Error
				removeFile(part)

				if (aborted) {
					break
				}
			}
		}

		if (aborted) {
			setState({
				phase: "idle",
				percent: 0,
				received: 0,
				message: "",
				ready: false,
			})
			return [null, state]
		}

		if (!downloaded) {
			return fail("Güncelleme: İndirme tamamlanamadı",
				lastErr || undefined)
		}

		setState({
			phase: "verifying",
			percent: 100,
			message: "İndirilen dosya doğrulanıyor",
		})

		let sha = ""

		try {
			sha = await expectedSha(target)
		} catch (err) {
			sha = ""
		}

		if (!sha) {
			removeFile(part)
			return fail("Güncelleme: Beklenen özet değeri bulunamadı")
		}

		if (sha !== downloaded.sha256) {
			removeFile(part)
			return fail("Güncelleme: İndirilen dosya doğrulanamadı " +
				"(özet uyuşmuyor)")
		}

		fs.renameSync(part, file)

		writePending(target, {
			tag: target.tag,
			file: path.basename(file),
			size: downloaded.size,
			sha256: sha,
		})

		setState({
			phase: "downloaded",
			percent: 100,
			received: downloaded.size,
			total: downloaded.size,
			message: "",
			ready: true,
		})

		return [null, state]
	} finally {
		running = false
	}
}

function darwinBundle(): string {
	let appPath = electron.app.getAppPath()

	if (!appPath) {
		return ""
	}

	let bundle = path.resolve(appPath, "..", "..", "..")

	if (!bundle.endsWith(".app")) {
		return ""
	}

	return bundle
}

async function installDarwin(target: Target, file: string):
		Promise<[string | null, State]> {

	if (process.arch !== "arm64") {
		return fail("Güncelleme: Otomatik kurulum yalnızca Apple Silicon " +
			"için destekleniyor")
	}

	let bundle = darwinBundle()

	if (!bundle) {
		return fail("Güncelleme: Uygulama klasörü bulunamadı")
	}

	let dir = targetDir(target)
	let extract = path.join(dir, "app")
	let source = path.join(extract, "Pritunl.app")

	setState({
		phase: "installing",
		percent: 100,
		message: "Güncelleme hazırlanıyor",
	})

	removeDir(extract)

	let unzip = await execFile("ditto", ["-x", "-k", file, extract])

	if (!unzip.ok) {
		return fail("Güncelleme: Arşiv açılamadı")
	}

	if (!fs.existsSync(source)) {
		return fail("Güncelleme: Arşivde Pritunl.app bulunamadı")
	}

	let plist = path.join(source, "Contents", "Info.plist")
	let identifier = await execFile("/usr/bin/defaults",
		["read", plist, "CFBundleIdentifier"])

	if (!identifier.ok ||
			identifier.stdout.trim() !== "com.electron.pritunl") {
		return fail("Güncelleme: Arşivdeki uygulama Pritunl değil")
	}

	let verify = await execFile("codesign",
		["--verify", "--deep", "--strict", source])

	if (!verify.ok) {
		return fail("Güncelleme: İndirilen uygulama imza doğrulamasından " +
			"geçemedi")
	}

	let scriptPath = path.join(dir, "install.sh")

	fs.writeFileSync(scriptPath, darwinScript(bundle, source,
		pendingFile(target)), "utf8")
	fs.chmodSync(scriptPath, 0o755)

	let elevated = !isWritable(path.dirname(bundle))

	if (elevated) {
		setState({
			phase: "installing",
			message: "Kuruluyor, yönetici parolası istenecek",
		})

		let apple = "do shell script \"/bin/sh '" + scriptPath +
			"'\" with administrator privileges"
		let result = await execFile("osascript", ["-e", apple])

		if (!result.ok) {
			let output = result.stdout + result.stderr

			if (output.indexOf("-128") !== -1 ||
					/cancel(ed|led)/i.test(output)) {
				return fail("Güncelleme: Yönetici izni verilmedi")
			}

			return fail("Güncelleme: Kurulum tamamlanamadı")
		}

		clearPending(target)

		setState({
			phase: "installing",
			message: "Kuruldu, uygulama yeniden açılıyor",
		})

		return [null, state]
	}

	setState({
		phase: "installing",
		message: "Kuruluyor",
	})

	childProcess.spawn("/bin/sh", [scriptPath], {
		detached: true,
		stdio: "ignore",
	}).unref()

	// Bekleyen güncelleme script tarafından yalnızca kurulum başarılı
	// olduğunda silinir; başarısız kurulumdan sonra "Kur" kalır.
	setState({
		phase: "installing",
		message: "Kuruluyor, uygulama yeniden başlatılacak",
	})

	return [null, state]
}

function darwinScript(bundle: string, source: string,
		pending: string): string {
	return [
		"#!/bin/sh",
		"BUNDLE='" + bundle + "'",
		"SRC='" + source + "'",
		"PENDING='" + pending + "'",
		"BAK=\"$BUNDLE.bak\"",
		"",
		"open_app() {",
		"\tif [ \"$(id -u)\" -eq 0 ]; then",
		"\t\tuser=$(/usr/bin/stat -f %Su /dev/console)",
		"\t\tif [ -n \"$user\" ] && [ \"$user\" != \"root\" ]; then",
		"\t\t\t/usr/bin/launchctl asuser \"$(id -u \"$user\")\" " +
				"/usr/bin/sudo -u \"$user\" /usr/bin/open \"$BUNDLE\" " +
				">/dev/null 2>&1",
		"\t\t\treturn",
		"\t\tfi",
		"\tfi",
		"\t/usr/bin/open \"$BUNDLE\" >/dev/null 2>&1",
		"}",
		"",
		"pkill -f \"$BUNDLE/Contents/MacOS/\" >/dev/null 2>&1",
		"i=0",
		"while [ $i -lt 40 ]; do",
		"\tif ! pgrep -f \"$BUNDLE/Contents/MacOS/\" >/dev/null 2>&1; then",
		"\t\tbreak",
		"\tfi",
		"\tsleep 0.25",
		"\ti=$((i+1))",
		"done",
		"",
		"rm -rf \"$BAK\"",
		"if [ -e \"$BUNDLE\" ]; then",
		"\tif ! mv \"$BUNDLE\" \"$BAK\"; then",
		"\t\topen_app",
		"\t\texit 3",
		"\tfi",
		"fi",
		"",
		"if ! ditto \"$SRC\" \"$BUNDLE\"; then",
		"\trm -rf \"$BUNDLE\"",
		"\tif [ -e \"$BAK\" ]; then mv \"$BAK\" \"$BUNDLE\"; fi",
		"\topen_app",
		"\texit 4",
		"fi",
		"",
		"xattr -dr com.apple.quarantine \"$BUNDLE\" >/dev/null 2>&1",
		"",
		"if ! codesign --verify --deep --strict \"$BUNDLE\" >/dev/null 2>&1; then",
		"\trm -rf \"$BUNDLE\"",
		"\tif [ -e \"$BAK\" ]; then mv \"$BAK\" \"$BUNDLE\"; fi",
		"\topen_app",
		"\texit 5",
		"fi",
		"",
		"rm -f \"$PENDING\"",
		"rm -rf \"$BAK\"",
		"open_app",
		"exit 0",
		"",
	].join("\n")
}

async function installWindows(target: Target, file: string):
		Promise<[string | null, State]> {

	let dir = targetDir(target)
	let rcPath = resultFile(target)
	let cmdPath = path.join(dir, "update.cmd")
	let appExe = electron.app.getPath("exe")

	removeFile(rcPath)

	let script = "try { " +
		"Unblock-File -LiteralPath '" + file + "'; " +
		"$p = Start-Process -FilePath '" + file + "' " +
		"-ArgumentList '/SILENT','/NORESTART','/CLOSEAPPLICATIONS' " +
		"-Verb RunAs -Wait -PassThru -ErrorAction Stop; " +
		"exit $p.ExitCode } catch { exit 1223 }"

	let batch = [
		"@echo off",
		"powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"" +
			script + "\"",
		"set RC=%ERRORLEVEL%",
		"> \"" + rcPath + "\" echo %RC%",
		"if not \"%RC%\"==\"0\" exit /b %RC%",
		"start \"\" \"" + appExe + "\"",
		"exit /b 0",
		"",
	].join("\r\n")

	fs.writeFileSync(cmdPath, batch, "utf8")

	setState({
		phase: "installing",
		percent: 100,
		message: "Kuruluyor, yönetici izni (UAC) istenecek",
	})

	childProcess.spawn("cmd.exe", ["/c", cmdPath], {
		detached: true,
		stdio: "ignore",
		windowsHide: true,
	}).unref()

	let code = await pollResult(rcPath, 120000)

	if (code === 1223) {
		return fail("Güncelleme: Yönetici izni verilmedi")
	}

	if (code === -1) {
		// Kurulum sonucu bilinmiyor, bekleyen indirme silinmez
		setState({
			message: "Kurulum sonucu alınamadı, uygulama yeniden " +
				"başlatılınca tekrar deneyin",
		})
		return [null, state]
	}

	if (code !== 0) {
		return fail("Güncelleme: Kurulum tamamlanamadı (kod " + code + ")")
	}

	clearPending(target)

	setState({
		phase: "installing",
		message: "Kuruldu, uygulama yeniden açılıyor",
	})

	return [null, state]
}

export async function install(target: Target):
		Promise<[string | null, State]> {

	if (running) {
		return ["Güncelleme: Zaten bir işlem sürüyor", state]
	}

	if (!target || !target.tag || !target.asset) {
		return fail("Güncelleme: Güncelleme bilgisi eksik")
	}

	let file = targetFile(target)

	if (!fs.existsSync(file)) {
		return fail("Güncelleme: İndirilen dosya bulunamadı")
	}

	running = true

	let result: [string | null, State] = [null, state]

	try {
		if (process.platform === "darwin") {
			result = await installDarwin(target, file)
		} else if (process.platform === "win32") {
			result = await installWindows(target, file)
		} else {
			result = fail("Güncelleme: Bu platformda otomatik kurulum " +
				"desteklenmiyor")
		}
	} finally {
		running = false
	}

	if (result[0]) {
		// Kurulum başarısız olduğunda indirilen dosya yerinde kalır, böylece
		// "Kur" yeniden denenebilir
		setState({
			ready: fs.existsSync(file),
		})
		result = [result[0], state]
	}

	return result
}
