/// <reference path="../References.d.ts"/>
import * as React from "react"
import ProfilesStore from "../stores/ProfilesStore"
import * as ProfileTypes from "../types/ProfileTypes"
import * as ProfileActions from "../actions/ProfileActions"
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
	dialogBody: {
		marginBottom: "0",
	} as React.CSSProperties,
	dataInfoBox: {
		maxHeight: "220px",
		overflowY: "auto",
		padding: "10px 12px",
		border: "1px solid rgba(16, 22, 26, 0.2)",
		borderRadius: "4px",
		background: "rgba(16, 22, 26, 0.03)",
	} as React.CSSProperties,
	info: {
		marginBottom: "0",
	} as React.CSSProperties,
	autoAuthNote: {
		margin: "6px 0 10px 0",
		fontSize: "12px",
		opacity: "0.7",
		lineHeight: "1.45",
	} as React.CSSProperties,
	autoAuthError: {
		marginTop: "8px",
		color: "#cd4246",
	} as React.CSSProperties,
	toggleDataBtn: {
		opacity: "0.75",
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
			return "Kullanıcı adı gerekli"
		}

		if (auto.secret && !Totp.isValidSecret(auto.secret)) {
			return "Geçerli bir base32 TOTP anahtarı girin"
		}

		if (!auto.pin && !auto.password && !auto.secret) {
			return "Bir PIN, parola veya TOTP anahtarı girin"
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
					autoAuthError: "Şuraya kaydedilemedi: " +
						AutoAuth.storageName(),
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
					null, "Profiller: Profil otomatik başlatması sunucu tarafından zorunlu kılınmış",
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
			lastSync = "Eşitlenemedi"
		} else if (profile.sync_time) {
			lastSync = MiscUtils.formatDateLess(profile.sync_time)
		} else {
			lastSync = "Hiçbir zaman"
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
							label: 'Yapılandırma Eşitleme Sunucuları',
							value: syncHosts,
						},
						{
							label: 'Sistem',
							value: profile.system,
						},
						{
							label: 'UV Adı',
							value: profile.uv_name,
						},
						{
							label: 'Durum',
							value: profile.state,
						},
						{
							label: 'WireGuard',
							value: profile.wg,
						},
						{
							label: 'Son Mod',
							value: profile.last_mode,
						},
						{
							label: 'Kuruluş Kimliği',
							value: profile.organization_id,
						},
						{
							label: 'Kuruluş',
							value: profile.organization,
						},
						{
							label: 'Sunucu Kimliği',
							value: profile.server_id,
						},
						{
							label: 'Sunucu',
							value: profile.server,
						},
						{
							label: 'Kullanıcı Kimliği',
							value: profile.user_id,
						},
						{
							label: 'Kullanıcı',
							value: profile.user,
						},
						{
							label: 'Bağlantı Öncesi Mesaj',
							value: profile.pre_connect_msg,
						},
						{
							label: 'Yeniden Bağlanmayı Devre Dışı Bırak',
							value: profile.disable_reconnect,
						},
						{
							label: 'Yerel Yeniden Bağlanmayı Devre Dışı Bırak',
							value: profile.disable_reconnect_local,
						},
						{
							label: 'İstemciyi Kısıtla',
							value: profile.restrict_client,
						},
						{
							label: 'Uzak Sunucu Verileri',
							value: JSON.stringify(profile.remotes_data),
						},
						{
							label: 'OpenVPN\'i Gizle',
							value: profile.hide_ovpn,
						},
						{
							label: 'Dinamik Güvenlik Duvarı',
							value: profile.dynamic_firewall,
						},
						{
							label: 'Coğrafi Sıralama',
							value: profile.geo_sort,
						},
						{
							label: 'Bağlantıyı Zorla',
							value: profile.force_connect,
						},
						{
							label: 'Cihaz Doğrulama',
							value: profile.device_auth,
						},
						{
							label: 'Ağ Geçidini Devre Dışı Bırak',
							value: profile.disable_gateway,
						},
						{
							label: 'DNS\'i Devre Dışı Bırak',
							value: profile.disable_dns,
						},
						{
							label: 'IPv6\'yı Devre Dışı Bırak',
							value: profile.disable_ipv6,
						},
						{
							label: 'Veri Kanalı Boşaltma',
							value: profile.dco,
						},
						{
							label: 'Hata Ayıklama Çıktısı',
							value: profile.debug_output,
						},
						{
							label: 'DNS\'i Zorla',
							value: profile.force_dns,
						},
						{
							label: 'SSO Doğrulama',
							value: profile.sso_auth,
						},
						{
							label: 'Parola Modu',
							value: profile.password_mode,
						},
						{
							label: 'Belirteç',
							value: profile.token,
						},
						{
							label: 'Belirteç Geçerlilik Süresi',
							value: profile.token_ttl,
						},
						{
							label: 'Eşitleme Özeti',
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
				Ayarlar
			</button>
			<Blueprint.Dialog
				title="Profil Ayarları"
				className="profile-settings-dialog"
				isOpen={this.state.dialog}
				usePortal={true}
				portalContainer={document.body}
				onClose={this.closeDialog}
			>
				<div className="bp5-dialog-body" style={css.dialogBody}>
					<div className="settings-section">
						<div className="settings-section-title">Profil</div>
						<PageInput
							disabled={this.state.disabled}
							label="Ad"
							help="Profil adı."
							type="text"
							placeholder="Ad girin"
							value={profile.name || ""}
							onChange={(val: string): void => {
								this.set("name", val)
							}}
						/>
						<PageSwitch
							disabled={this.state.disabled}
							label="Sistem Profili"
							help="Profili sistem hizmetiyle otomatik olarak başlat. Otomatik başlatılan profiller tüm kullanıcılar için çalışır."
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
							label="Otomatik Başlat"
							help="Profili sistem hizmetiyle otomatik olarak başlat. Otomatik başlatılan profiller tüm kullanıcılar için çalışır. Otomatik başlatma için profil sistem profili olmalıdır."
							checked={autostart && system}
							onToggle={(): void => {
								this.set("disabled", !!autostart)
							}}
						/>
					</div>

					{autoAuthSupported ? <div className="settings-section">
						<div className="settings-section-title">
							Otomatik PIN ve OTP
						</div>
						<PageSwitch
							disabled={this.state.disabled || !this.state.autoAuthLoaded}
							label="Otomatik Girişi Etkinleştir"
							help={"Profil kimlik bilgilerini " + AutoAuth.storageName() + " içinde sakla ve istemeden bağlan."}
							checked={!!auto.enabled}
							onToggle={(): void => {
								this.setAutoAuth("enabled", !auto.enabled)
							}}
						/>
						<div style={css.autoAuthNote} hidden={!auto.enabled}>
							PIN, TOTP anahtarı veya her ikisini girin. Yalnızca
							doldurduğunuz alanlar gönderilir.
						</div>
						<PageInput
							disabled={this.state.disabled || !this.state.autoAuthLoaded}
							hidden={!auto.enabled ||
								authModes.indexOf("password") === -1}
							label="Parola"
							help="VPN hesap parolası. Atlamak için boş bırakın."
							type="password"
							placeholder="Parola girin"
							value={auto.password}
							onChange={(val: string): void => {
								this.setAutoAuth("password", val)
							}}
						/>
						<PageInput
							disabled={this.state.disabled || !this.state.autoAuthLoaded}
							hidden={!auto.enabled ||
								authModes.indexOf("pin") === -1}
							label="PIN"
							help="VPN PIN'i. Yalnızca TOTP kodu göndermek için boş bırakın."
							type="password"
							placeholder="PIN girin"
							value={auto.pin}
							onChange={(val: string): void => {
								this.setAutoAuth("pin", val)
							}}
						/>
						<PageInput
							disabled={this.state.disabled || !this.state.autoAuthLoaded}
							hidden={!auto.enabled ||
								authModes.indexOf("username") === -1}
							label="Kullanıcı Adı"
							help="VPN kullanıcı adı."
							type="text"
							placeholder="Kullanıcı adı girin"
							value={auto.username}
							onChange={(val: string): void => {
								this.setAutoAuth("username", val)
							}}
						/>
						<PageInput
							disabled={this.state.disabled || !this.state.autoAuthLoaded}
							hidden={!auto.enabled ||
								authModes.indexOf("otp") === -1}
							label="TOTP Anahtarı"
							help="İsteğe bağlı. Doğrulayıcı QR kodundaki base32 anahtarı. Yalnızca PIN göndermek için boş bırakın."
							type="password"
							placeholder="Base32 anahtarı girin"
							value={auto.secret}
							onChange={(val: string): void => {
								this.setAutoAuth("secret", val)
							}}
						/>
						<PageSwitch
							disabled={this.state.disabled || !this.state.autoAuthLoaded}
							hidden={!auto.enabled}
							label="Uygulama Açılışında Bağlan"
							help="Uygulama başladığında bu profile otomatik olarak bağlan."
							checked={!!auto.auto_connect}
							onToggle={(): void => {
								this.setAutoAuth("auto_connect", !auto.auto_connect)
							}}
						/>
						<div
							className="settings-test-row"
							hidden={!auto.enabled ||
								authModes.indexOf("otp") === -1}
						>
							<button
								className="bp5-button bp5-minimal bp5-icon-key"
								type="button"
								disabled={this.state.disabled ||
									!Totp.isValidSecret(auto.secret)}
								onClick={(): void => {
									this.setState({
										...this.state,
										autoAuthTest: Totp.generateCode(auto.secret) +
											" (" + Totp.secondsRemaining() + " sn)",
									})
								}}
							>Kodu Test Et</button>
							<span className="settings-test-code">
								{this.state.autoAuthTest}
							</span>
						</div>
						<div style={css.autoAuthError}
							hidden={!this.state.autoAuthError}>
							{this.state.autoAuthError}
						</div>
					</div> : null}

					<div className="settings-section">
						<div className="settings-section-title">Ağ</div>
						<div className="settings-grid">
							<PageSwitch
								label="Otomatik Yeniden Bağlanmayı Devre Dışı Bırak"
								help="Bağlantı koptuğunda otomatik yeniden bağlanmayı devre dışı bırak."
								hidden={!!system || profile.restrict_client}
								checked={!!profile.disable_reconnect_local}
								onToggle={(): void => {
									this.set("disable_reconnect_local",
										!profile.disable_reconnect_local)
								}}
							/>
							<PageSwitch
								label="Varsayılan Ağ Geçidini Devre Dışı Bırak"
								help="İnternet trafiğini VPN bağlantısı üzerinden yönlendirmeyi devre dışı bırak."
								hidden={profile.restrict_client}
								checked={!!profile.disable_gateway}
								onToggle={(): void => {
									this.set("disable_gateway", !profile.disable_gateway)
								}}
							/>
							<PageSwitch
								label="DNS'i Devre Dışı Bırak"
								help="Sunucunun bu profil için sağladığı DNS yapılandırmasının uygulanmasını devre dışı bırak."
								hidden={profile.restrict_client}
								checked={!!profile.disable_dns}
								onToggle={(): void => {
									this.set("disable_dns", !profile.disable_dns)
								}}
							/>
							<PageSwitch
								label="IPv6'yı Devre Dışı Bırak"
								help="Sunucunun bu profil için sağladığı IPv6 yapılandırmasını yoksay. IPv6 devre dışı olan makinelerde IPv6 adres ve rotalarının uygulanmasından kaynaklanan bağlantı hatalarını önlemek için kullanın."
								hidden={profile.restrict_client && !profile.disable_ipv6}
								checked={!!profile.disable_ipv6}
								onToggle={(): void => {
									this.set("disable_ipv6", !profile.disable_ipv6)
								}}
							/>
							<PageSwitch
								label="Veri Kanalı Boşaltma"
								help="Daha iyi performans için Veri Kanalı Boşaltma'yı etkinleştir. Sunucu desteği ve yapılandırma değişiklikleri gerektirir."
								hidden={profile.restrict_client}
								checked={!!profile.dco}
								onToggle={(): void => {
									this.set("dco", !profile.dco)
								}}
							/>
							<PageSwitch
								label="DNS Yapılandırmasını Zorla"
								help="macOS'taki DNS sunucusu önceliği sorunlarını gidermek için yalnızca tek bir DNS sunucusu yapılandır. Gerekli değilse önerilmez ve ağ uyumluluğu sorunlarına yol açabilir."
								hidden={
									!profile.force_dns &&
									(Constants.platform !== "darwin" || !this.state.showData)
								}
								checked={!!profile.force_dns}
								onToggle={(): void => {
									this.set("force_dns", !profile.force_dns)
								}}
							/>
						</div>
					</div>

					<div className="settings-section">
						<div className="settings-section-title">Hata Ayıklama</div>
						<div className="settings-grid">
							<PageSwitch
								label="Hata Ayıklama Çıktısı"
								help="Bu profil için hata ayıklama günlüğünü etkinleştir."
								hidden={profile.restrict_client}
								checked={!!profile.debug_output}
								onToggle={(): void => {
									this.set("debug_output", !profile.debug_output)
								}}
							/>
						</div>
					</div>

					<div className="settings-section">
						<div className="settings-section-title">Bilgi</div>
						<PageInfo
							style={css.info}
							fields={[
								{
									label: 'Kimlik',
									value: profile.id || '-',
								},
								{
									label: 'Son Yapılandırma Eşitlemesi',
									value: lastSync,
								},
							]}
						/>
						{dataInfo}
					</div>
				</div>
				<div className="bp5-dialog-footer">
					<div className="bp5-dialog-footer-actions">
						<button
							className="bp5-button bp5-minimal bp5-icon-console"
							type="button"
							style={css.toggleDataBtn}
							disabled={this.state.disabled}
							onClick={this.toggleData}
						>Hata Ayıklama Verisi</button>
						<button
							className="bp5-button"
							type="button"
							disabled={this.state.disabled}
							onClick={this.closeDialog}
						>Vazgeç
						</button>
						<button
							className="bp5-button bp5-intent-success bp5-icon-tick"
							type="button"
							disabled={this.state.disabled || !this.state.changed}
							onClick={this.onSave}
						>Kaydet
						</button>
					</div>
				</div>
			</Blueprint.Dialog>
		</div>
	}
}
