/// <reference path="../References.d.ts"/>
import * as Constants from "../Constants"
import * as MiscUtils from "../utils/MiscUtils"
import * as Errors from "../Errors"
import * as Logger from "../Logger"
import path from "path"

export const SYNC = "zero.sync"
export const CHANGE = "zero.change"

export const DEF_KNOWN_HOSTS_PATH = "~/.ssh/known_hosts"
export const DEF_SSH_CONF_PATH = "~/.ssh/config"

export interface ZeroHost {
	domain?: string
	matches?: string[]
	strict_host_checking?: boolean
	strict_bastion_checking?: boolean
	proxy_host?: string
}

export interface Zero {
	id?: string
	name?: string
	server?: string
	public_key_path?: string
	ssh_card_serial?: string
	known_hosts_path?: string
	ssh_config_path?: string
	certificate_authorities?: string[]
	hosts?: ZeroHost[]

	cert_paths?: string[]
	cert_valid_to?: number

	formattedName(): string
	formattedNameShort(): string
	formattedHost(): string
	formattedKey(): string
	formattedStatus(): string
	formattedExpires(): string
	certValid(): boolean
	confPath(): string
	baseCertPath(): string
	exportConf(): string
	importConf(data: Zero): void
	writeConf(): Promise<void>
	delete(): Promise<void>
}

export type Zeros = Zero[]
export type ZerosMap = {[key: string]: Zero}

export type ZeroRo = Zero
export type ZerosRo = Zero[]

export interface ZeroDispatch {
	type: string
	data?: {
		id?: string
		zero?: Zero
		zeros?: Zeros
	}
}

export function New(self: Zero): Zero {
	self.formattedName = function(): string {
		if (this.name) {
			return this.name
		}

		let keyName: string
		if (this.ssh_card_serial) {
			keyName = "Smart Card"
		} else {
			keyName = path.basename(this.public_key_path || "")
		}

		if (keyName) {
			return this.formattedHost() + " (" + keyName + ")"
		}
		return this.formattedHost()
	}

	self.formattedNameShort = function(): string {
		if (this.name) {
			return this.name
		}
		return this.formattedHost()
	}

	self.formattedHost = function(): string {
		try {
			return new URL(this.server).host
		} catch {
			return this.server || ""
		}
	}

	self.formattedKey = function(): string {
		if (this.ssh_card_serial) {
			return "Smart Card (" + this.ssh_card_serial + ")"
		}
		return this.public_key_path || "-"
	}

	self.formattedStatus = function(): string {
		if (!this.cert_paths || !this.cert_paths.length) {
			return "No Certificate"
		}
		if (this.certValid()) {
			return "Valid"
		}
		return "Expired"
	}

	self.formattedExpires = function(): string {
		if (!this.cert_paths || !this.cert_paths.length ||
			!this.cert_valid_to) {

			return ""
		}
		return MiscUtils.formatDateLess(this.cert_valid_to)
	}

	self.certValid = function(): boolean {
		if (!this.cert_paths || !this.cert_paths.length ||
			!this.cert_valid_to) {

			return false
		}

		let curTime = Math.floor((new Date).getTime() / 1000) + 30
		return curTime < this.cert_valid_to
	}

	self.confPath = function(): string {
		return path.join(Constants.dataPath, "zero", this.id + ".conf")
	}

	self.baseCertPath = function(): string {
		if (this.ssh_card_serial) {
			return "~/.ssh/pritunl-" + this.id + "-cert.pub"
		}

		let pubKeyPath: string = this.public_key_path || ""
		if (pubKeyPath.endsWith(".pub")) {
			pubKeyPath = pubKeyPath.substring(0, pubKeyPath.length - 4)
		}

		return pubKeyPath + "-" + this.id + "-cert.pub"
	}

	self.exportConf = function(): string {
		return JSON.stringify({
			name: this.name,
			server: this.server,
			public_key_path: this.public_key_path,
			ssh_card_serial: this.ssh_card_serial,
			known_hosts_path: this.known_hosts_path,
			ssh_config_path: this.ssh_config_path,
			certificate_authorities: this.certificate_authorities,
			hosts: this.hosts,
		})
	}

	self.importConf = function(data: Zero): void {
		this.name = data.name
		this.server = data.server
		this.public_key_path = data.public_key_path
		this.ssh_card_serial = data.ssh_card_serial
		this.known_hosts_path = data.known_hosts_path
		this.ssh_config_path = data.ssh_config_path
		this.certificate_authorities = data.certificate_authorities || []
		this.hosts = data.hosts || []
	}

	self.writeConf = async function(): Promise<void> {
		let zeroPath = this.confPath()

		try {
			await MiscUtils.dirMake(path.dirname(zeroPath))
			await MiscUtils.fileWrite(zeroPath, this.exportConf())
			if (Constants.platform !== "win32") {
				await MiscUtils.fileChmod(zeroPath, 0o600)
			}
		} catch (err) {
			err = new Errors.WriteError(
				err, "Zero: SSH write error",
				{zero_path: zeroPath})
			Logger.errorAlert(err, 10)
		}
	}

	self.delete = async function(): Promise<void> {
		try {
			await MiscUtils.fileDelete(this.confPath())
		} catch {}
	}

	return self
}
