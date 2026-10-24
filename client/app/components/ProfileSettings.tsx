/// <reference path="../References.d.ts"/>
import * as React from "react"
import * as Theme from "../Theme"
import ProfilesStore from "../stores/ProfilesStore"
import * as ProfileTypes from "../types/ProfileTypes"
import * as ProfileActions from "../actions/ProfileActions"
import * as ServiceActions from "../actions/ServiceActions"
import * as Blueprint from "@blueprintjs/core"
import PageInfo from "./PageInfo"
import PageInput from "./PageInput"
import PageSwitch from "./PageSwitch"
import * as MiscUtils from "../utils/MiscUtils";
import * as AutoAuth from "../utils/AutoAuth";
import * as Totp from "../utils/Totp";
import * as Constants from "../Constants";
import * as Errors from "../Errors";
import * as Logger from "../Logger";

interface Props {
	profile: ProfileTypes.ProfileRo
}

interface State {
	disabled: boolean
	changed: boolean
	dialog: boolean
	profile: ProfileTypes.Profile
	setAutoStart: boolean
	setSystem: boolean
	showData: boolean
	autoAuth: AutoAuth.AutoAuthData
	autoAuthLoaded: boolean
	autoAuthTest: string
	autoAuthError: string
}

const css = {
	box: {
		display: "inline-block"
	} as React.CSSProperties,
	button: {
		marginTop: "10px",
		marginRight: "10px",
	} as React.CSSProperties,
	dialog: {
		width: "340px",
		position: "absolute",
	} as React.CSSProperties,
	dialogBody: {
		marginBottom: "0",
	} as React.CSSProperties,
	dialogFooter: {
		marginTop: "10px",
	} as React.CSSProperties,
	info: {
		marginBottom: "0",
	} as React.CSSProperties,
	label: {
		width: "100%",
		maxWidth: "220px",
		margin: "18px 0 0 0",
	} as React.CSSProperties,
	input: {
		width: "100%",
	} as React.CSSProperties,
	toggleDataBtn: {
		opacity: "0.5",
	} as React.CSSProperties,
	dataInfoBox: {
		height: "100px",
		overflowY: "scroll",
		border: "1px solid rgba(16, 22, 26, 0.4)",
		borderRadius: "2px",
	} as React.CSSProperties,
	sectionTitle: {
		margin: "18px 0 0 0",
	} as React.CSSProperties,
	autoAuthTest: {
		marginLeft: "6px",
		opacity: "0.8",
	} as React.CSSProperties,
	autoAuthError: {
		marginTop: "8px",
		color: "#cd4246",
	} as React.CSSProperties,
	autoAuthNote: {
		marginTop: "8px",
		opacity: "0.7",
	} as React.CSSProperties,
}

export default class ProfileSettings extends React.Component<Props, State> {
	constructor(props: Props, context: any) {
		super(props, context)
		this.state = {
			disabled: false,
			changed: false,
			dialog: false,
			profile: null,
			setAutoStart: null,
			setSystem: null,
			showData: false,
			autoAuth: AutoAuth.empty(),
			autoAuthLoaded: false,
			autoAuthTest: "",
			autoAuthError: "",
		}
	}

	set(name: string, val: any): void {
		let profile: any

		if (this.state.changed) {
			profile = {
				...this.state.profile,
			}
		} else {
			profile = {
				...this.props.profile,
			}
		}

		profile[name] = val

		if (name === "disabled") {
			this.setState({
				...this.state,
				changed: true,
				profile: profile,
				setAutoStart: !profile.disabled,
			})
		} else {
			this.setState({
				...this.state,
				changed: true,
				profile: profile,
			})
		}
	}

	setAutoAuth(name: string, val: any): void {
		this.setState({
			...this.state,
			changed: true,
			autoAuth: {
				...this.state.autoAuth,
				[name]: val,
			},
			autoAuthTest: "",
			autoAuthError: "",
		})
	}

	validateAutoAuth(profile: ProfileTypes.Profile): string {
		let auto = this.state.autoAuth

		if (!auto || !auto.enabled) {
			return ""
		}

		let modes = (profile.password_mode || "").split("_")

		if (modes.indexOf("username") !== -1 && !auto.username) {
			return "Username is required"
		}

		if (auto.secret && !Totp.isValidSecret(auto.secret)) {
			return "Enter a valid base32 TOTP secret"
		}

		if (!auto.pin && !auto.password && !auto.secret) {
			return "Enter a PIN, password, or TOTP secret"
		}

		return ""
	}

	onSave = async (): Promise<void> => {
		let prfl = this.state.profile
		let profile = prfl || this.props.profile

		if (this.state.autoAuthLoaded) {
			let autoAuthError = this.validateAutoAuth(profile)

			if (autoAuthError) {
				this.setState({
					...this.state,
					autoAuthError: autoAuthError,
				})
				return
			}

			let saved = await AutoAuth.save(profile.id, this.state.autoAuth)

			if (!saved) {
				this.setState({
					...this.state,
					autoAuthError: "Failed to save to macOS Keychain",
				})
				return
			}
		}

		this.setState({
			...this.state,
			disabled: true,
			autoAuthError: "",
		})

		if (prfl) {
			if (this.state.setAutoStart !== null) {
				prfl.disabled = !this.state.setAutoStart
			}

			if (prfl.force_connect && prfl.disabled) {
				let err = new Errors.WriteError(
					null, "Profiles: Profile autostart enforced by server",
					{profile_id: prfl.id}
				)
				Logger.errorAlert(err, 10)
				prfl.disabled = false
				this.setState({
					...this.state,
					setAutoStart: null,
				})
				return
			}

			ProfileActions.commit(prfl).then(() => {
				if (this.state.setSystem !== null) {
					this.onSaveSystem()
				} else {
					this.setState({
						...this.state,
						changed: false,
						disabled: false,
						profile: null,
					})
					this.closeDialog()
				}
			})
		} else {
			if (this.state.setSystem !== null) {
				this.onSaveSystem()
			} else {
				this.setState({
					...this.state,
					changed: false,
					disabled: false,
					profile: null,
				})
				this.closeDialog()
			}
		}
	}

	onSaveSystem = (): void => {
		let prfl: ProfileTypes.Profile = this.state.profile ||
			this.props.profile;

		if (this.state.setSystem && !prfl.system) {
			prfl.disabled = !this.state.setAutoStart
			prfl.convertSystem().then((): void => {
				this.setState({
					...this.state,
					changed: false,
					disabled: false,
					profile: null,
				})
				this.closeDialog()
			})
		} else if (!this.state.setSystem && !!prfl.system) {
			prfl.convertUser().then((): void => {
				this.setState({
					...this.state,
					changed: false,
					disabled: false,
					profile: null,
				})
				this.closeDialog()
			})
		}
	}

	openDialog = (): void => {
		this.setState({
			...this.state,
			dialog: true,
			autoAuthError: "",
			autoAuthTest: "",
		})

		AutoAuth.load(this.props.profile.id).then((data): void => {
			this.setState({
				...this.state,
				autoAuth: data,
				autoAuthLoaded: true,
			})
		})
	}

	closeDialog = (): void => {
		this.setState({
			...this.state,
			dialog: false,
			changed: false,
			profile: null,
			setAutoStart: null,
			setSystem: null,
			autoAuthError: "",
			autoAuthTest: "",
		})
	}

	toggleData = (): void => {
		this.setState({
			...this.state,
			showData: !this.state.showData,
		})
	}

	render(): JSX.Element {
		let profile: ProfileTypes.Profile = this.state.profile ||
			this.props.profile;

		let system = !!profile.system
		if (this.state.setSystem !== null) {
			system = this.state.setSystem
		}

		let autostart = !profile.disabled && !!profile.system
		if (this.state.setAutoStart !== null) {
			autostart = this.state.setAutoStart
		}

		let syncHosts = profile.formatedHosts();

		let lastSync = ""
		if (profile.sync_time === -1) {
			lastSync = "Failed to sync"
		} else if (profile.sync_time) {
			lastSync = MiscUtils.formatDateLess(profile.sync_time)
		} else {
			lastSync = "Never"
		}

		let auto = this.state.autoAuth || AutoAuth.empty()
		let authModes = (profile.password_mode || "").split("_")
		let autoAuthSupported = authModes.length > 0 &&
			authModes.indexOf("duo") === -1 &&
			authModes.indexOf("onelogin") === -1 &&
			authModes.indexOf("okta") === -1 &&
			authModes.indexOf("yubikey") === -1

		let dataInfo: JSX.Element;
		if (this.state.showData) {
			dataInfo = <div style={css.dataInfoBox}>
				<PageInfo
					fields={[
						{
							label: 'Configuration Sync Hosts',
							value: syncHosts,
						},
						{
							label: 'System',
							value: profile.system,
						},
						{
							label: 'UV Name',
							value: profile.uv_name,
						},
						{
							label: 'State',
							value: profile.state,
						},
						{
							label: 'WireGuard',
							value: profile.wg,
						},
						{
							label: 'Last Mode',
							value: profile.last_mode,
						},
						{
							label: 'Organization ID',
							value: profile.organization_id,
						},
						{
							label: 'Organization',
							value: profile.organization,
						},
						{
							label: 'Server ID',
							value: profile.server_id,
						},
						{
							label: 'Server',
							value: profile.server,
						},
						{
							label: 'User ID',
							value: profile.user_id,
						},
						{
							label: 'User',
							value: profile.user,
						},
						{
							label: 'Pre Connect Message',
							value: profile.pre_connect_msg,
						},
						{
							label: 'Disable Reconnect',
							value: profile.disable_reconnect,
						},
						{
							label: 'Disable Reconnect Local',
							value: profile.disable_reconnect_local,
						},
						{
							label: 'Restrict Client',
							value: profile.restrict_client,
						},
						{
							label: 'Remotes Data',
							value: JSON.stringify(profile.remotes_data),
						},
						{
							label: 'Hide OpenVPN',
							value: profile.hide_ovpn,
						},
						{
							label: 'Dynamic Firewall',
							value: profile.dynamic_firewall,
						},
						{
							label: 'Geo Sort',
							value: profile.geo_sort,
						},
						{
							label: 'Force Connect',
							value: profile.force_connect,
						},
						{
							label: 'Device Auth',
							value: profile.device_auth,
						},
						{
							label: 'Disable Gateway',
							value: profile.disable_gateway,
						},
						{
							label: 'Disable DNS',
							value: profile.disable_dns,
						},
						{
							label: 'Disable IPv6',
							value: profile.disable_ipv6,
						},
						{
							label: 'Data Channel Offload',
							value: profile.dco,
						},
						{
							label: 'Debug Output',
							value: profile.debug_output,
						},
						{
							label: 'Force DNS',
							value: profile.force_dns,
						},
						{
							label: 'SSO Auth',
							value: profile.sso_auth,
						},
						{
							label: 'Password Mode',
							value: profile.password_mode,
						},
						{
							label: 'Token',
							value: profile.token,
						},
						{
							label: 'Token TTL',
							value: profile.token_ttl,
						},
						{
							label: 'Sync Hash',
							value: profile.sync_hash,
						},
					]}
				/>
			</div>
		}

		return <div style={css.box}>
			<button
				className="bp5-button bp5-icon-cog"
				style={css.button}
				type="button"
				disabled={this.state.disabled}
				onClick={this.openDialog}
			>
				Settings
			</button>
			<Blueprint.Dialog
				title="Profile Settings"
				style={css.dialog}
				isOpen={this.state.dialog}
				usePortal={true}
				portalContainer={document.body}
				onClose={this.closeDialog}
			>
				<div className="bp5-dialog-body" style={css.dialogBody}>
					<PageInput
						disabled={this.state.disabled}
						label="Name"
						help="Profile name."
						type="text"
						placeholder="Enter name"
						value={profile.name || ""}
						onChange={(val: string): void => {
							this.set("name", val)
						}}
					/>
					<PageSwitch
						disabled={this.state.disabled}
						label="System Profile"
						help="Automatically start profile with system service. Autostart profiles will run for all users."
						checked={system}
						onToggle={(): void => {
							let profile: any

							if (this.state.changed) {
								profile = {
									...this.state.profile,
								}
							} else {
								profile = {
									...this.props.profile,
								}
							}

							if (!system && this.state.setAutoStart === null) {
								this.setState({
									...this.state,
									changed: true,
									profile: profile,
									setSystem: !system,
									setAutoStart: true,
								})
							} else {
								this.setState({
									...this.state,
									changed: true,
									profile: profile,
									setSystem: !system,
								})
							}
						}}
					/>
					<PageSwitch
						disabled={this.state.disabled || !system}
						label="Autostart"
						help="Automatically start profile with system service. Autostart profiles will run for all users. Must be system profile to use autostart."
						checked={autostart && system}
						onToggle={(): void => {
							this.set("disabled", !!autostart)
						}}
					/>
					<PageSwitch
						label="Disable Auto Reconnect"
						help="Disable automatically reconnecting on disconnect."
						hidden={!!system || profile.restrict_client}
						checked={!!profile.disable_reconnect_local}
						onToggle={(): void => {
							this.set("disable_reconnect_local",
								!profile.disable_reconnect_local)
						}}
					/>
					{autoAuthSupported ? <div>
						<h4 style={css.sectionTitle}>Auto Auth</h4>
						<PageSwitch
							disabled={this.state.disabled || !this.state.autoAuthLoaded}
							label="Enable Auto Auth"
							help="Store the profile credentials in the macOS Keychain and connect without prompting."
							checked={!!auto.enabled}
							onToggle={(): void => {
								this.setAutoAuth("enabled", !auto.enabled)
							}}
						/>
						<div style={css.autoAuthNote} hidden={!auto.enabled}>
							Enter the PIN, the TOTP secret, or both. Only the
							fields you fill in are sent.
						</div>
						<PageInput
							disabled={this.state.disabled || !this.state.autoAuthLoaded}
							hidden={!auto.enabled ||
								authModes.indexOf("password") === -1}
							label="Password"
							help="VPN account password. Leave empty to skip it."
							type="password"
							placeholder="Enter password"
							value={auto.password}
							onChange={(val: string): void => {
								this.setAutoAuth("password", val)
							}}
						/>
						<PageInput
							disabled={this.state.disabled || !this.state.autoAuthLoaded}
							hidden={!auto.enabled ||
								authModes.indexOf("pin") === -1}
							label="Pin"
							help="VPN pin. Leave empty to send only the TOTP code."
							type="password"
							placeholder="Enter pin"
							value={auto.pin}
							onChange={(val: string): void => {
								this.setAutoAuth("pin", val)
							}}
						/>
						<PageInput
							disabled={this.state.disabled || !this.state.autoAuthLoaded}
							hidden={!auto.enabled ||
								authModes.indexOf("username") === -1}
							label="Username"
							help="VPN username."
							type="text"
							placeholder="Enter username"
							value={auto.username}
							onChange={(val: string): void => {
								this.setAutoAuth("username", val)
							}}
						/>
						<PageInput
							disabled={this.state.disabled || !this.state.autoAuthLoaded}
							hidden={!auto.enabled ||
								authModes.indexOf("otp") === -1}
							label="TOTP Secret"
							help="Optional. Base32 secret from the authenticator QR code. Leave empty to send only the PIN."
							type="password"
							placeholder="Enter base32 secret"
							value={auto.secret}
							onChange={(val: string): void => {
								this.setAutoAuth("secret", val)
							}}
						/>
						<PageSwitch
							disabled={this.state.disabled || !this.state.autoAuthLoaded}
							hidden={!auto.enabled}
							label="Connect on App Start"
							help="Automatically connect this profile when the app starts."
							checked={!!auto.auto_connect}
							onToggle={(): void => {
								this.setAutoAuth("auto_connect", !auto.auto_connect)
							}}
						/>
						<div hidden={!auto.enabled ||
								authModes.indexOf("otp") === -1}>
							<button
								className="bp5-button bp5-minimal bp5-icon-key"
								type="button"
								disabled={this.state.disabled ||
									!Totp.isValidSecret(auto.secret)}
								onClick={(): void => {
									this.setState({
										...this.state,
										autoAuthTest: Totp.generateCode(auto.secret) +
											" (" + Totp.secondsRemaining() + "s)",
									})
								}}
							>Test Code</button>
							<span style={css.autoAuthTest}>
								{this.state.autoAuthTest}
							</span>
						</div>
						<div style={css.autoAuthError}
							hidden={!this.state.autoAuthError}>
							{this.state.autoAuthError}
						</div>
					</div> : null}
					<PageSwitch
						label="Disable Default Gateway"
						help="Disable routing internet traffic through the VPN connection."
						hidden={profile.restrict_client}
						checked={!!profile.disable_gateway}
						onToggle={(): void => {
							this.set("disable_gateway", !profile.disable_gateway)
						}}
					/>
					<PageSwitch
						label="Disable DNS"
						help="Disable configuring the DNS configuration provided by the server on this profile."
						hidden={profile.restrict_client}
						checked={!!profile.disable_dns}
						onToggle={(): void => {
							this.set("disable_dns", !profile.disable_dns)
						}}
					/>
					<PageSwitch
						label="Disable IPv6"
						help="Ignore the IPv6 configuration provided by the server on this profile. Use when the host has IPv6 disabled to prevent connection failures applying IPv6 addresses and routes."
						hidden={profile.restrict_client && !profile.disable_ipv6}
						checked={!!profile.disable_ipv6}
						onToggle={(): void => {
							this.set("disable_ipv6", !profile.disable_ipv6)
						}}
					/>
					<PageSwitch
						label="Data Channel Offload"
						help="Enable Data Channel Offload for improved performance. Requires server support and configuration changes."
						hidden={profile.restrict_client}
						checked={!!profile.dco}
						onToggle={(): void => {
							this.set("dco", !profile.dco)
						}}
					/>
					<PageSwitch
						label="Debug Output"
						help="Enable debug output logging for this profile."
						hidden={profile.restrict_client}
						checked={!!profile.debug_output}
						onToggle={(): void => {
							this.set("debug_output", !profile.debug_output)
						}}
					/>
					<PageSwitch
						label="Force DNS configuration"
						help="Configure only one DNS server to correct issues with macOS DNS server priority. This is not recommended unless required and will cause networking compatibility issues."
						hidden={
							!profile.force_dns &&
							(Constants.platform !== "darwin" || !this.state.showData)
						}
						checked={!!profile.force_dns}
						onToggle={(): void => {
							this.set("force_dns", !profile.force_dns)
						}}
					/>
					<PageInfo
						style={css.info}
						fields={[
							{
								label: 'ID',
								value: profile.id || '-',
							},
							{
								label: 'Last Configuration Sync',
								value: lastSync,
							},
						]}
					/>
					{dataInfo}
				</div>
				<div className="bp5-dialog-footer" style={css.dialogFooter}>
					<div className="bp5-dialog-footer-actions">
						<button
							className="bp5-button bp5-icon-console"
							type="button"
							style={css.toggleDataBtn}
							disabled={this.state.disabled}
							onClick={this.toggleData}
						>Debugging</button>
						<button
							className="bp5-button bp5-intent-danger bp5-icon-cross"
							type="button"
							disabled={this.state.disabled}
							onClick={this.closeDialog}
						>Cancel
						</button>
						<button
							className="bp5-button bp5-intent-success bp5-icon-tick"
							type="button"
							disabled={this.state.disabled || !this.state.changed}
							onClick={this.onSave}
						>Save
						</button>
					</div>
				</div>
			</Blueprint.Dialog>
		</div>
	}
}
