/// <reference path="../References.d.ts"/>
import * as React from 'react';
import * as Theme from "../Theme";
import ProfilesStore from '../stores/ProfilesStore';
import * as ProfileTypes from '../types/ProfileTypes';
import * as ProfileActions from '../actions/ProfileActions';
import * as ServiceActions from '../actions/ServiceActions';
import * as Constants from "../Constants";
import * as MiscUtils from "../utils/MiscUtils";
import * as Blueprint from "@blueprintjs/core";
import * as PageInfos from './PageInfo';
import ConfirmButton from "./ConfirmButton";
import PageInfo from './PageInfo';
import PageSwitch from './PageSwitch';
import ProfileConnect from "./ProfileConnect";
import ProfileSettings from "./ProfileSettings";
import MetricCharts from "./MetricCharts";

interface Props {
	profile: ProfileTypes.ProfileRo;
	minimal: boolean;
}

interface State {
	open: boolean;
	collapsed: boolean;
	message: string;
	disabled: boolean;
	changed: boolean;
	value: string;
}

const css = {
	box: {
		paddingTop: "31px",
	} as React.CSSProperties,
	message: {
		margin: '0 0 6px 0',
	} as React.CSSProperties,
	toast: {
		margin: '0 20px 10px 0',
	} as React.CSSProperties,
	toastHeader: {
		fontWeight: "bold",
	} as React.CSSProperties,
	label: {
		marginBottom: '0',
	} as React.CSSProperties,
	labelLast: {
		marginBottom: '-5px',
	} as React.CSSProperties,
	card: {
		position: "relative",
		margin: '0 8px 8px 0',
		paddingRight: 0,
	} as React.CSSProperties,
	progress: {
		width: '100%',
		height: '4px',
		borderRadius: 0,
	} as React.CSSProperties,
	progressBar: {
		width: '50%',
		borderRadius: 0,
	} as React.CSSProperties,
	button: {
		marginRight: '10px',
	} as React.CSSProperties,
	deleteButton: {
	} as React.CSSProperties,
	buttons: {
	} as React.CSSProperties,
	editor: {
		margin: '10px 0 0 0',
	} as React.CSSProperties,
	header: {
		userSelect: 'none',
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		padding: '4px',
		height: '39px',
		color: 'inherit',
		border: 'none',
		font: 'inherit',
		cursor: 'default',
		outline: 'inherit',
	} as React.CSSProperties,
	headerClosed: {
		userSelect: 'none',
		position: 'absolute',
		top: '1px',
		left: '1px',
		right: '2px',
		padding: '4px',
		height: '36px',
		color: 'inherit',
		border: 'none',
		font: 'inherit',
		cursor: 'pointer',
		backgroundColor: 'inherit',
		outline: 'none',
	} as React.CSSProperties,
	headerLabel: {
		fontSize: "1.09em",
		margin: "4px 6px 0 6px",
		overflow: "hidden",
		whiteSpace: "nowrap",
		textOverflow: "ellipsis",
		minWidth: 0,
		flexShrink: 1,
	} as React.CSSProperties,
	statusTag: {
		margin: "3px 8px 1px 0",
		flexShrink: 0,
	} as React.CSSProperties,
	headerButtons: {
		display: "flex",
		alignItems: "center",
		flexShrink: 0,
	} as React.CSSProperties,
	collapseButton: {
		marginTop: "-1px",
	} as React.CSSProperties,
	body: {
	} as React.CSSProperties,
	regBox: {
		padding: "0 20px 10px 0",
	} as React.CSSProperties,
	reg: {
		textAlign: "center",
	} as React.CSSProperties,
	regTitle: {
		margin: "3px 0 0 0",
	} as React.CSSProperties,
	regName: {
		margin: "1px 0 0 0",
		fontSize: "14px",
		fontWeight: "normal",
	} as React.CSSProperties,
	regKey: {
		margin: "1px 0",
		fontWeight: "bold",
	} as React.CSSProperties,
};

export default class Profile extends React.Component<Props, State> {
	constructor(props: Props, context: any) {
		super(props, context);
		this.state = {
			open: false,
			collapsed: false,
			message: '',
			disabled: false,
			changed: false,
			value: 'test',
		};
	}

	componentDidMount(): void {
		Constants.addChangeListener(this.onChange);
	}

	componentWillUnmount(): void {
		Constants.removeChangeListener(this.onChange);
	}

	onChange = (): void => {
		this.setState({
			...this.state,
		});
	}

	onHeaderClick = (evt: React.MouseEvent<HTMLDivElement>): void => {
		let open = !!this.props.profile.registration_key ||
			(!this.state.collapsed &&
				(!this.props.minimal || this.state.open))

		if (open) {
			return
		}

		let target = evt.target as HTMLElement
		if (target.className && target.className.indexOf &&
				target.className.indexOf('tab-toggle') !== -1) {

			this.setState({
				...this.state,
				open: true,
				collapsed: false,
			})
		}
	}

	onToggleCollapsed = (evt: React.MouseEvent<HTMLElement>): void => {
		evt.stopPropagation()

		if (this.props.profile.registration_key) {
			return
		}

		let collapsed = !this.state.collapsed

		this.setState({
			...this.state,
			open: !collapsed,
			collapsed: collapsed,
		})
	}

	onDelete = (): void => {
		this.setState({
			...this.state,
			disabled: true,
		})

		let profile: ProfileTypes.Profile = this.props.profile

		profile.delete().then((): void => {
			this.setState({
				...this.state,
				disabled: false,
			})
			ProfileActions.sync()
		})
	}

	render(): JSX.Element {
		let profile: ProfileTypes.Profile = this.props.profile;

		let statusLabel = "Çevrimiçi Süre"
		let statusVal = profile.formattedUptime()
		if (statusVal === "") {
			statusLabel = "Durum"
			statusVal = profile.formattedStatus()
		}
		let open = !!profile.registration_key ||
			(!this.state.collapsed &&
				(!this.props.minimal || this.state.open))

		let fieldsLeft: PageInfos.Field[] = [
			{
				label: 'Kullanıcı',
				value: profile.user || '-',
			},
			{
				label: 'Sunucu',
				value: profile.server || '-',
			},
		]

		let fieldsRight: PageInfos.Field[] = [
			{
				label: statusLabel,
				value: statusVal,
			},
			{
				label: 'Kuruluş',
				value: profile.organization || '-',
			},
		]

		let fieldsLong: PageInfos.Field[] = []

		let longIp = false
		if ((profile.server_addr && profile.server_addr.length >= 16) ||
			(profile.client_addr && profile.client_addr.length >= 16)) {

			fieldsLong.push({
				label: 'Sunucu Adresi',
				value: profile.server_addr || '-',
				copy: !!profile.server_addr,
			})
			fieldsLong.push({
				label: 'İstemci Adresi',
				value: profile.client_addr || '-',
				copy: !!profile.client_addr,
			})

			longIp = true
		} else if (profile.server_addr || profile.client_addr) {
			fieldsLeft.push({
				label: 'Sunucu Adresi',
				value: profile.server_addr || '-',
				copy: !!profile.server_addr,
			})
			fieldsRight.push({
				label: 'İstemci Adresi',
				value: profile.client_addr || '-',
				copy: !!profile.client_addr,
			})
		}

		let statusBadge = <div
			className={"bp5-tag bp5-minimal" + (profile.status === "connected" ?
				" bp5-intent-success" : "")}
			style={css.statusTag}
			title={profile.formattedStatus()}
		>{profile.status === "connected" ? "Bağlı" : "Bağlı değil"}</div>

		let deleteButton = <ConfirmButton
			className="bp5-minimal bp5-intent-danger bp5-icon-trash"
			style={css.deleteButton}
			safe={true}
			progressClassName="bp5-intent-danger"
			dialogClassName="bp5-intent-danger bp5-icon-delete"
			dialogLabel="Profili Sil"
			confirmMsg="Bu profil kalıcı olarak silinsin mi?"
			items={[profile.formattedName()]}
			disabled={this.state.disabled}
			onConfirm={this.onDelete}
		/>

		let header = <div
			className={"layout horizontal tab-toggle" +
				(open ? " bp5-card-header" : "")}
			style={open ? css.header : css.headerClosed}
			onClick={this.onHeaderClick}
		>
			<h3
				className="tab-toggle"
				style={css.headerLabel}
			>{profile.formattedNameShort() || 'Profil'}</h3>
			{!open ? statusBadge : null}
			<div className="flex tab-toggle"/>
			<ProfileConnect
				profile={this.props.profile}
				minimal={true}
				hidden={open}
				autoAuth={true}
			/>
			<div style={css.headerButtons}>
				{open ? deleteButton : null}
				<Blueprint.Button
					className="bp5-minimal"
					style={css.collapseButton}
					icon={open ? "chevron-up" : "chevron-down"}
					title={open ? "Profili daralt" : "Profili genişlet"}
					aria-label={open ? "Profili daralt" : "Profili genişlet"}
					type="button"
					disabled={!!profile.registration_key}
					onClick={this.onToggleCollapsed}
				/>
			</div>
		</div>

		return <div className="bp5-card layout vertical" style={css.card}>
			{header}
			<div style={css.box} hidden={!open}>
				<div
					style={css.toast}
					hidden={!profile.auth_reconnect}
					className="bp5-toast bp5-intent-primary bp5-overlay-content"
				>
					<span className="bp5-toast-message">
						<span style={css.toastHeader}>Bağlantı Kesildi</span><br/>
						Yeniden bağlanmak için kimlik doğrulama gerekli
					</span>
				</div>
				<div
					className="layout vertical"
					style={css.regBox}
					hidden={!profile.registration_key}
				>
					<div className="bp5-card layout vertical" style={css.reg}>
						<h3
							className="bp5-text-intent-danger"
							style={css.regTitle}
						>Cihaz Kaydı Gerekli</h3>
						Sunucu yöneticisine şu kodla başvurun:
						<h3
							className="bp5-text-intent-primary"
							style={css.regName}
						>{Constants.hostname}</h3>
						<h1
							className="bp5-text-intent-primary"
							style={css.regKey}
						>{profile.registration_key}</h1>
					</div>
				</div>
				<div className="layout horizontal" style={css.body}>
					<PageInfo
						style={css.label}
						fields={fieldsLeft}
					/>
					<PageInfo
						style={css.label}
						fields={fieldsRight}
					/>
				</div>
				<PageInfo
					style={css.labelLast}
					hidden={!longIp}
					fields={fieldsLong}
				/>
				<div style={css.message} hidden={!this.state.message}>
					{this.state.message}
				</div>
				<MetricCharts
					profile={profile.id}
					disabled={!open}
				/>
				<div className="layout horizontal">
					<div style={css.buttons}>
						<ProfileConnect
							profile={this.props.profile}
							autoAuth={true}
						/>
						<ProfileSettings profile={this.props.profile}/>
					</div>
				</div>
			</div>
		</div>;
	}
}
