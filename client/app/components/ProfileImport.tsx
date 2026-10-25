/// <reference path="../References.d.ts"/>
import * as React from "react"
import * as ZeroActions from "../actions/ZeroActions"
import * as ZeroUtils from "../utils/ZeroUtils"
import * as Alert from "../Alert"
import * as Blueprint from "@blueprintjs/core"
import Help from "./Help"
import PageInput from "./PageInput"
import PageInputFile from "./PageInputFile"
import * as Importer from "../utils/Importer"
import * as Constants from "../Constants"
import path from "path"

interface Props {
	style: React.CSSProperties
}

interface State {
	disabled: boolean
	changed: boolean
	dialog: boolean
	zeroAvailable: boolean
	mode: string
	uri: string
	path: string
	fullPath: string
	zeroServer: string
	zeroCard: ZeroUtils.SmartCard
	zeroKeys: string[]
	zeroKeysLoaded: boolean
	zeroSelectedKey: string
	zeroPath: string
	zeroFullPath: string
}

const css = {
	box: {
		display: "inline-block"
	} as React.CSSProperties,
	button: {
		marginRight: "10px",
	} as React.CSSProperties,
	dialog: {
	} as React.CSSProperties,
	group: {
		margin: "0 0 15px 0",
	} as React.CSSProperties,
	label: {
		width: "100%",
		maxWidth: "280px",
	} as React.CSSProperties,
	input: {
		width: "100%",
	} as React.CSSProperties,
	select: {
		marginTop: "5px",
		width: "100%",
	} as React.CSSProperties,
	selectBox: {
		display: "block",
		width: "100%",
		maxWidth: "280px",
		marginTop: "1px",
	} as React.CSSProperties,
}

export default class ProfileImport extends React.Component<Props, State> {
	constructor(props: Props, context: any) {
		super(props, context)
		this.state = {
			disabled: false,
			changed: false,
			dialog: false,
			zeroAvailable: !Constants.flatpak,
			mode: "vpn",
			uri: "",
			path: "",
			fullPath: "",
			zeroServer: "",
			zeroCard: null,
			zeroKeys: [],
			zeroKeysLoaded: false,
			zeroSelectedKey: "",
			zeroPath: "",
			zeroFullPath: "",
		}
	}

	loadZeroKeys = (): void => {
		ZeroActions.listKeys().then(
			(keyOptions: ZeroActions.KeyOptions): void => {

				let selectedKey = this.state.zeroSelectedKey
				if (!selectedKey && !this.state.zeroFullPath) {
					if (keyOptions.card) {
						selectedKey = "card"
					} else if (keyOptions.keys.length) {
						selectedKey = keyOptions.keys[0]
					}
				}

				this.setState({
					...this.state,
					zeroCard: keyOptions.card,
					zeroKeys: keyOptions.keys,
					zeroKeysLoaded: true,
					zeroSelectedKey: selectedKey,
				})
			})
	}

	setMode = (mode: string): void => {
		this.setState({
			...this.state,
			mode: mode,
		})

		if (mode === "zero" && !this.state.zeroKeysLoaded) {
			this.loadZeroKeys()
		}
	}

	onImportVpn = (): void => {
		this.setState({
			...this.state,
			disabled: true,
		})

		if (this.state.fullPath !== "") {
			Importer.importFile(this.state.fullPath).then(() => {
				this.setState({
					...this.state,
					dialog: false,
					disabled: false,
					changed: false,
					uri: "",
					path: "",
					fullPath: "",
				})
			})
		} else {
			Importer.importUri(this.state.uri).then(() => {
				this.setState({
					...this.state,
					dialog: false,
					disabled: false,
					changed: false,
					uri: "",
					path: "",
					fullPath: "",
				})
			})
		}
	}

	onImportZero = (): void => {
		let cardSerial = ""
		let publicKeyPath = ""

		if (this.state.zeroFullPath !== "") {
			publicKeyPath = this.state.zeroFullPath
		} else if (this.state.zeroSelectedKey === "card") {
			if (this.state.zeroCard) {
				cardSerial = this.state.zeroCard.serial
			}
		} else if (this.state.zeroSelectedKey) {
			publicKeyPath = ZeroUtils.SSH_DIR + "/" +
				this.state.zeroSelectedKey
		}

		if (!cardSerial && !publicKeyPath) {
			Alert.error("SSH anahtarı seçilmedi. Anahtar oluşturmak için " +
				"\"ssh-keygen -t ed25519\" komutunu çalıştırın.")
			return
		}

		this.setState({
			...this.state,
			disabled: true,
		})

		ZeroActions.importZero({
			server: this.state.zeroServer,
			publicKeyPath: publicKeyPath,
			cardSerial: cardSerial,
		}).then((success: boolean): void => {
			if (!success) {
				this.setState({
					...this.state,
					disabled: false,
				})
				return
			}

			if (cardSerial) {
				Alert.info("Akıllı kartın Pritunl Zero'ya kaydedilmesi gerekir. " +
					"Cihazı kaydetmek için profildeki Kart Kaydet'i kullanın.", 10)
			}

			this.setState({
				...this.state,
				dialog: false,
				disabled: false,
				changed: false,
				zeroServer: "",
				zeroKeysLoaded: false,
				zeroSelectedKey: "",
				zeroPath: "",
				zeroFullPath: "",
			})
		})
	}

	onImport = (): void => {
		if (this.state.mode === "zero") {
			this.onImportZero()
		} else {
			this.onImportVpn()
		}
	}

	openDialog = (): void => {
		this.setState({
			...this.state,
			dialog: true,
		})

		if (this.state.mode === "zero" && !this.state.zeroKeysLoaded) {
			this.loadZeroKeys()
		}

		if (Constants.flatpak) {
			ZeroUtils.sshDirAvailable().then((available: boolean): void => {
				this.setState({
					...this.state,
					zeroAvailable: available,
					mode: available ? this.state.mode : "vpn",
				})
			})
		}
	}

	closeDialog = (): void => {
		this.setState({
			...this.state,
			dialog: false,
		})
	}

	render(): JSX.Element {
		let zeroMode = this.state.mode === "zero" && this.state.zeroAvailable

		let importDisabled = this.state.disabled
		if (zeroMode) {
			importDisabled = importDisabled || !this.state.zeroServer
		} else {
			importDisabled = importDisabled || !this.state.changed
		}

		let zeroKeyOptions: JSX.Element[] = []

		if (this.state.zeroCard) {
			zeroKeyOptions.push(<option key="card" value="card">
				{"Akıllı Kart (" + this.state.zeroCard.serial + ")"}
			</option>)
		}

		for (let key of this.state.zeroKeys) {
			zeroKeyOptions.push(<option key={key} value={key}>{key}</option>)
		}

		if (!zeroKeyOptions.length) {
			zeroKeyOptions.push(<option key="" value="">
				SSH anahtarı bulunamadı
			</option>)
		}

		return <div style={css.box}>
			<button
				className="bp5-button bp5-minimal bp5-icon-import"
				style={this.props.style}
				type="button"
				disabled={this.state.disabled}
				onClick={this.openDialog}
			>
				İçe Aktar
			</button>
			<Blueprint.Dialog
				title="Profil İçe Aktar"
				className="profile-import-dialog"
				style={css.dialog}
				isOpen={this.state.dialog}
				usePortal={true}
				portalContainer={document.body}
				onClose={this.closeDialog}
			>
				<div className="bp5-dialog-body">
					<div
						className="bp5-button-group bp5-fill"
						style={css.group}
						hidden={process.platform === 'win32' ||
							!this.state.zeroAvailable}
					>
						<button
							className={"bp5-button bp5-icon-globe-network" +
								(!zeroMode ? " bp5-active" : "")}
							type="button"
							disabled={this.state.disabled}
							onClick={(): void => {
								this.setMode("vpn")
							}}
						>Pritunl VPN</button>
						<button
							className={"bp5-button bp5-icon-key" +
								(zeroMode ? " bp5-active" : "")}
							type="button"
							disabled={this.state.disabled}
							onClick={(): void => {
								this.setMode("zero")
							}}
						>Pritunl Zero</button>
					</div>
					<div hidden={zeroMode}>
						<PageInput
							disabled={this.state.disabled}
							label="Profil URI'si"
							help="Pritunl sunucu web konsolunda gösterilen profil URI'si."
							type="text"
							placeholder="URI girin"
							value={this.state.uri}
							onChange={(val: string): void => {
								this.setState({
									...this.state,
									changed: true,
									uri: val,
									path: "",
									fullPath: "",
								})
							}}
						/>
						<PageInputFile
							disabled={this.state.disabled}
							label="Profil İçe Aktar"
							help="tar, zip, ovpn veya conf biçimindeki profil dosyasını seçin."
							accept=".ovpn,.conf,.tar,.zip"
							value={this.state.path}
							onChange={(val: string): void => {
								this.setState({
									...this.state,
									changed: true,
									uri: "",
									path: path.basename(val),
									fullPath: val,
								})
							}}
						/>
					</div>
					<div hidden={!zeroMode}>
						<PageInput
							disabled={this.state.disabled}
							label="Pritunl Zero Sunucusu"
							help="Pritunl Zero web konsolunda gösterilen Pritunl Zero kullanıcı ana bilgisayar adı."
							type="text"
							placeholder="Sunucu ana bilgisayar adını girin"
							value={this.state.zeroServer}
							onChange={(val: string): void => {
								this.setState({
									...this.state,
									changed: true,
									zeroServer: val,
								})
							}}
						/>
						<label
							className="bp5-label"
							style={css.label}
						>
							SSH Anahtarı
							<Help
								title="SSH Anahtarı"
								content="Pritunl Zero sunucusu tarafından imzalanacak SSH anahtarını veya akıllı kart cihazını seçin."
							/>
							<div
								className="bp5-html-select"
								style={css.selectBox}
							>
								<select
									style={css.select}
									disabled={this.state.disabled}
									value={this.state.zeroSelectedKey}
									onChange={(evt): void => {
										this.setState({
											...this.state,
											changed: true,
											zeroSelectedKey: evt.target.value,
											zeroPath: "",
											zeroFullPath: "",
										})
									}}
								>
									{zeroKeyOptions}
								</select>
							</div>
						</label>
						<PageInputFile
							disabled={this.state.disabled}
							label="SSH Genel Anahtar Dosyası"
							help="SSH dizininde olmayan bir anahtarı kullanmak için .pub ile biten SSH genel anahtar dosyasını seçin."
							accept=".pub"
							value={this.state.zeroPath}
							onChange={(val: string): void => {
								this.setState({
									...this.state,
									changed: true,
									zeroSelectedKey: "",
									zeroPath: path.basename(val),
									zeroFullPath: val,
								})
							}}
						/>
					</div>
				</div>
				<div className="bp5-dialog-footer">
					<div className="bp5-dialog-footer-actions">
						<button
							className="bp5-button bp5-intent-danger bp5-icon-cross"
							type="button"
							disabled={this.state.disabled}
							onClick={this.closeDialog}
						>Vazgeç</button>
						<button
							className="bp5-button bp5-intent-success bp5-icon-tick"
							type="button"
							disabled={importDisabled}
							onClick={this.onImport}
						>İçe Aktar</button>
					</div>
				</div>
			</Blueprint.Dialog>
		</div>
	}
}
