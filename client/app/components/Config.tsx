/// <reference path="../References.d.ts"/>
import * as React from "react"
import * as ConfigActions from "../actions/ConfigActions"
import * as ConfigTypes from "../types/ConfigTypes"
import Config from "../Config"
import ConfigStore from "../stores/ConfigStore"
import PageSwitch from "./PageSwitch"
import PageNumInput from "./PageNumInput"

interface Props {
	onClose: () => void
}

interface State {
	config: ConfigTypes.Config
	safeStorage: boolean
	transparentWindow: boolean
	changed: boolean
	disabled: boolean
}

const css = {
	message: {
		margin: "0 0 6px 0",
	} as React.CSSProperties,
	header: {
		margin: "0 0 5px 0",
	} as React.CSSProperties,
	card: {
		position: "relative",
		margin: "8px",
	} as React.CSSProperties,
	buttonsTop: {
		position: "absolute",
		top: "5px",
		right: "5px",
	} as React.CSSProperties,
	footer: {
		margin: 0,
	} as React.CSSProperties,
}

export default class ConfigView extends React.Component<Props, State> {
	constructor(props: any, context: any) {
		super(props, context);
		this.state = {
			config: ConfigStore.config,
			safeStorage: null,
			transparentWindow: null,
			changed: false,
			disabled: false,
		};
	}

	componentDidMount(): void {
		ConfigStore.addChangeListener(this.onChange)
		ConfigActions.sync()
	}

	componentWillUnmount(): void {
		ConfigStore.removeChangeListener(this.onChange)
	}

	onChange = (): void => {
		this.setState({
			...this.state,
			config: ConfigStore.config,
		})
	}

	set(name: string, val: any): void {
		let config: any

		config = {
			...this.state.config,
		}

		config[name] = val

		this.setState({
			...this.state,
			changed: true,
			config: config,
		})
	}

	onCancel = (): void => {
		this.setState({
			...this.state,
			safeStorage: null,
			transparentWindow: null,
			changed: false,
			config: ConfigStore.config,
		})
	}

	onSave = (): void => {
		this.setState({
			...this.state,
			disabled: true,
		})

		if (this.state.safeStorage !== null ||
			this.state.transparentWindow !== null) {

			let opts: {[key: string]: any} = {}
			if (this.state.safeStorage !== null) {
				opts["safe_storage"] = this.state.safeStorage
			}
			if (this.state.transparentWindow !== null) {
				opts["transparent_window"] = this.state.transparentWindow
			}
			Config.save(opts)
		}

		if (this.state.config) {
			ConfigActions.commit(this.state.config).then(() => {
				this.setState({
					...this.state,
					changed: false,
					disabled: false,
				})
			})
		}
	}

	render(): JSX.Element {
		let safeStorage = this.state.safeStorage
		if (safeStorage === null) {
			safeStorage = Config.safe_storage
		}
		let transparentWindow = this.state.transparentWindow
		if (transparentWindow === null) {
			transparentWindow = Config.transparent_window
		}

		return <div className="bp5-card layout vertical flex" style={css.card}>
			<div style={css.buttonsTop}>
				<button
					className="bp5-button bp5-minimal bp5-icon-cross"
					onClick={this.props.onClose}
				/>
			</div>
			<div className="layout horizontal">
				<h3 style={css.header}>Gelişmiş Ayarlar</h3>
			</div>
			<div className="layout horizontal">
				<PageSwitch
					disabled={this.state.disabled}
					label="DNS yenilemeyi etkinleştir"
					help="macOS DNS önbelleğiyle ilgili sorunları gidermek için DNS'i otomatik olarak yenile."
					checked={!!this.state.config.enable_dns_refresh}
					onToggle={(): void => {
						this.set("enable_dns_refresh",
							!this.state.config.enable_dns_refresh)
					}}
				/>
			</div>
			<div className="layout horizontal">
				<PageSwitch
					disabled={this.state.disabled}
					label="DNS izlemeyi devre dışı bırak"
					help="Sistem ağı değişikliğinde yapılandırma kaybolursa DNS değişikliklerinin otomatik düzeltilmesini devre dışı bırak."
					checked={!!this.state.config.disable_dns_watch}
					onToggle={(): void => {
						this.set("disable_dns_watch",
							!this.state.config.disable_dns_watch)
					}}
				/>
			</div>
			<div className="layout horizontal">
				<PageSwitch
					disabled={this.state.disabled}
					label="WireGuard DNS izlemeyi devre dışı bırak"
					help="macOS'ta WireGuard DNS izlemeyi devre dışı bırak."
					checked={!!this.state.config.disable_wg_dns}
					onToggle={(): void => {
						this.set("disable_wg_dns",
							!this.state.config.disable_wg_dns)
					}}
				/>
			</div>
			<div className="layout horizontal">
				<PageSwitch
					disabled={this.state.disabled}
					label="Cihaz uyanma izlemeyi devre dışı bırak"
					help="Cihaz uykudan döndüğünde daha hızlı yeniden bağlanmak için kullanılan uyanma izlemeyi devre dışı bırak."
					checked={!!this.state.config.disable_wake_watch}
					onToggle={(): void => {
						this.set("disable_wake_watch",
							!this.state.config.disable_wake_watch)
					}}
				/>
			</div>
			<div className="layout horizontal">
				<PageSwitch
					disabled={this.state.disabled}
					label="Ağ temizliğini devre dışı bırak"
					help="Başlangıçta Windows VPN arayüzü temizliğini devre dışı bırak."
					checked={!!this.state.config.disable_net_clean}
					onToggle={(): void => {
						this.set("disable_net_clean",
							!this.state.config.disable_net_clean)
					}}
				/>
			</div>
			<div className="layout horizontal">
				<PageSwitch
					disabled={this.state.disabled}
					label="Tarayıcı açmayı devre dışı bırak"
					help="Tek oturum açma kimlik doğrulaması için tarayıcının otomatik açılmasını devre dışı bırak."
					checked={!!this.state.config.disable_browser}
					onToggle={(): void => {
						this.set("disable_browser",
							!this.state.config.disable_browser)
					}}
				/>
			</div>
			<div className="layout horizontal">
				<PageSwitch
					disabled={this.state.disabled}
					label="Saydam pencere"
					help="Saydam pencereyi etkinleştir; çoğu yapılandırma için kullanılmamalıdır. Değişikliğin uygulanması için istemciyi yeniden başlatın."
					checked={!!transparentWindow}
					onToggle={(): void => {
						this.setState({
							...this.state,
							changed: true,
							transparentWindow: !transparentWindow,
						})
					}}
				/>
			</div>
			<div className="layout horizontal">
				<PageSwitch
					disabled={this.state.disabled}
					label="Güvenli depolamayı etkinleştir"
					help="Profil anahtarlarının güvenli depolama ile şifrelenmesini etkinleştir. İstemcinin yanıt vermemesine veya bağlantıların başarısız olmasına neden olabilir."
					checked={!!safeStorage}
					onToggle={(): void => {
						this.setState({
							...this.state,
							changed: true,
							safeStorage: !safeStorage,
						})
					}}
				/>
			</div>
			<div className="layout horizontal">
				<PageNumInput
					label="Arayüz Metriği"
					help="Windows'ta VPN arayüzlerinin metriğini yapılandır. Arayüzleri değiştirmeden bırakmak için 0 yapın."
					min={0}
					max={9999}
					stepSize={1}
					disabled={this.state.disabled}
					selectAllOnFocus={true}
					value={this.state.config.interface_metric}
					onChange={(val: number): void => {
						this.set('interface_metric', val);
					}}
				/>
			</div>
			<div className="layout horizontal flex"/>
			<div className="bp5-dialog-footer" style={css.footer}>
				<div className="bp5-dialog-footer-actions">
					<button
						className="bp5-button bp5-intent-danger bp5-icon-cross"
						type="button"
						disabled={this.state.disabled || !this.state.changed}
						onClick={this.onCancel}
					>Vazgeç</button>
					<button
						className="bp5-button bp5-intent-success bp5-icon-tick"
						type="button"
						disabled={this.state.disabled || !this.state.changed}
						onClick={this.onSave}
					>Kaydet</button>
				</div>
			</div>
		</div>;
	}
}
