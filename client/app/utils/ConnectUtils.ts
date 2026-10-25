/// <reference path="../References.d.ts"/>
import * as ProfileTypes from "../types/ProfileTypes"
import * as ServiceActions from "../actions/ServiceActions"
import * as AutoAuth from "./AutoAuth"
import * as Logger from "../Logger"

export async function connectProfile(prfl: ProfileTypes.ProfileRo,
	mode: string, username: string, password: string,
	data?: string): Promise<boolean> {

	if (!data) {
		data = await prfl.readData()
	}

	if (!data) {
		return false
	}

	if (!prfl.system) {
		Logger.info("Profiller: '" + prfl.id + "' profili güncelleniyor")
		await prfl.writeData(data)
	}

	let serverPubKey = ""
	if (prfl.server_public_key) {
		serverPubKey = prfl.server_public_key.join("\n")
	}

	let connData: ProfileTypes.ProfileData = {
		id: prfl.id,
		mode: mode,
		org_id: prfl.organization_id,
		user_id: prfl.user_id,
		server_id: prfl.server_id,
		sync_hosts: prfl.sync_hosts,
		sync_token: prfl.sync_token,
		sync_secret: prfl.sync_secret,
		sync_hash: prfl.sync_hash,
		username: username,
		password: password,
		remotes_data: prfl.remotes_data,
		hide_ovpn: prfl.hide_ovpn,
		dynamic_firewall: prfl.dynamic_firewall,
		geo_sort: prfl.geo_sort,
		force_connect: prfl.force_connect,
		device_auth: prfl.device_auth,
		disable_gateway: prfl.disable_gateway,
		disable_dns: prfl.disable_dns,
		disable_ipv6: prfl.disable_ipv6,
		dco: prfl.dco,
		debug_output: prfl.debug_output,
		force_dns: prfl.force_dns,
		restrict_client: prfl.restrict_client,
		sso_auth: prfl.sso_auth,
		server_public_key: serverPubKey,
		server_box_public_key: prfl.server_box_public_key,
		token_ttl: prfl.token_ttl,
		timeout: true,
		reconnect: !(prfl.disable_reconnect || prfl.disable_reconnect_local),
		data: data,
	}

	await ServiceActions.connect(connData)

	return true
}

export async function autoCredentials(prfl: ProfileTypes.ProfileRo,
	data?: string): Promise<AutoAuth.AutoAuthCredentials | null> {

	let auto = await AutoAuth.load(prfl.id)

	if (!auto || !auto.enabled || AutoAuth.isFailed(prfl.id)) {
		return null
	}

	if (!data) {
		data = await prfl.readData()
	}

	if (!data) {
		return null
	}

	let authType = prfl.getAuthType(data)
	let authTypes: string[] = []
	if (authType) {
		authTypes = authType.split("_")
	}

	return AutoAuth.buildCredentials(authTypes, auto)
}

export async function connectAuto(prfl: ProfileTypes.ProfileRo,
	mode: string, data?: string): Promise<boolean> {

	if (!data) {
		data = await prfl.readData()
	}

	let creds = await autoCredentials(prfl, data)

	if (!creds) {
		return false
	}

	return connectProfile(prfl, mode, creds.username, creds.password, data)
}
