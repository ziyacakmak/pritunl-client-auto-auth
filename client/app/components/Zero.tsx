/// <reference path="../References.d.ts"/>
import * as React from 'react';
import * as ZeroTypes from '../types/ZeroTypes';
import * as ZeroActions from '../actions/ZeroActions';
import * as Constants from "../Constants";
import * as PageInfos from './PageInfo';
import ConfirmButton from "./ConfirmButton";
import PageInfo from './PageInfo';

interface Props {
	zero: ZeroTypes.ZeroRo;
	minimal: boolean;
}

interface State {
	open: boolean;
	message: string;
	disabled: boolean;
	renewing: boolean;
}

const css = {
	box: {
		paddingTop: "31px",
	} as React.CSSProperties,
	message: {
		margin: '0 0 6px 0',
	} as React.CSSProperties,
	label: {
		marginBottom: '0',
	} as React.CSSProperties,
	card: {
		position: "relative",
		margin: '0 8px 8px 0',
		paddingRight: 0,
	} as React.CSSProperties,
	button: {
		marginTop: "10px",
		marginRight: "5px",
	} as React.CSSProperties,
	buttonMinimal: {
		marginTop: "0",
		marginRight: "5px",
	} as React.CSSProperties,
	deleteButton: {
	} as React.CSSProperties,
	deleteButtonBox: {
		marginTop: "-1px",
	} as React.CSSProperties,
	buttons: {
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
	headerOpen: {
		userSelect: 'none',
		position: 'absolute',
		top: '0',
		left: '0',
		right: '0',
		padding: '4px',
		height: '36px',
		color: 'inherit',
		border: 'none',
		font: 'inherit',
		cursor: 'pointer',
		outline: 'none',
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
		margin: "4px 0 0 6px",
		overflow: "hidden",
		whiteSpace: "nowrap",
	} as React.CSSProperties,
	headerTag: {
		margin: "3px 8px 1px 0",
		flexShrink: 0,
	} as React.CSSProperties,
	body: {
	} as React.CSSProperties,
};

export default class Zero extends React.Component<Props, State> {
	constructor(props: Props, context: any) {
		super(props, context);
		this.state = {
			open: false,
			message: '',
			disabled: false,
			renewing: false,
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

	onRenew = (): void => {
		if (this.state.disabled) {
			return
		}

		this.setState({
			...this.state,
			disabled: true,
			renewing: true,
			message: 'Requesting certificate',
		})

		ZeroActions.renew(this.props.zero, (message: string): void => {
			this.setState({
				...this.state,
				message: message,
			})
		}).then((): void => {
			this.setState({
				...this.state,
				disabled: false,
				renewing: false,
				message: '',
			})
		})
	}

	onCancelRenew = (): void => {
		this.setState({
			...this.state,
			message: 'Cancelling renewal',
		})

		ZeroActions.cancelRenew(this.props.zero)
	}

	onRegister = (): void => {
		this.setState({
			...this.state,
			disabled: true,
		})

		ZeroActions.registerCard(this.props.zero).then((): void => {
			this.setState({
				...this.state,
				disabled: false,
			})
		})
	}

	onResetGpg = (): void => {
		this.setState({
			...this.state,
			disabled: true,
			message: 'Resetting GPG agent',
		})

		ZeroActions.resetGpg().then((): void => {
			this.setState({
				...this.state,
				disabled: false,
				message: '',
			})
		})
	}

	onDelete = (): void => {
		this.setState({
			...this.state,
			disabled: true,
		})

		ZeroActions.removeZero(this.props.zero).then((): void => {
			this.setState({
				...this.state,
				disabled: false,
			})
		})
	}

	render(): JSX.Element {
		let zero: ZeroTypes.Zero = this.props.zero;
		let open = this.state.open

		let statusClass = ""
		let status = zero.formattedStatus()
		if (status === "Valid") {
			statusClass = "bp5-text-intent-success"
		} else if (status === "Expired") {
			statusClass = "bp5-text-intent-danger"
		}

		let fieldsLeft: PageInfos.Field[] = [
			{
				label: 'Server',
				value: zero.formattedHost() || '-',
			},
			{
				label: 'SSH Key',
				value: zero.formattedKey(),
			},
		]

		let fieldsRight: PageInfos.Field[] = [
			{
				label: 'Certificate',
				value: status,
				valueClass: statusClass,
			},
			{
				label: 'Expires',
				value: zero.formattedExpires() || '-',
			},
		]

		let zeroTag: JSX.Element = <div
			className="bp5-tag bp5-intent-primary tab-toggle"
			style={css.headerTag}
		>Pritunl Zero</div>

		let deleteButton: JSX.Element = <div
			style={css.deleteButtonBox}
			hidden={this.props.minimal && !open}
		>
			<ConfirmButton
				className="bp5-minimal bp5-intent-danger bp5-icon-trash"
				style={css.deleteButton}
				safe={true}
				progressClassName="bp5-intent-danger"
				dialogClassName="bp5-intent-danger bp5-icon-delete"
				dialogLabel="Delete Pritunl Zero Profile"
				confirmMsg="Permanently delete this Pritunl Zero profile"
				items={[zero.formattedName()]}
				disabled={this.state.disabled}
				onConfirm={this.onDelete}
			/>
		</div>

		let header: JSX.Element;
		if (this.props.minimal) {
			header = <button
				className={(open ? "bp5-card-header " : "") +
					"layout horizontal tab-toggle"}
				style={open ? css.headerOpen : css.headerClosed}
				onClick={(evt): void => {
					let target = evt.target as HTMLElement;

					if (this.props.minimal &&
						target.className && target.className.indexOf &&
						target.className.indexOf('tab-toggle') !== -1) {

						this.setState({
							...this.state,
							open: !open,
						})
					}
				}}
			>
				<h3
					className="tab-toggle"
					style={css.headerLabel}
				>{zero.formattedNameShort() || 'Profile'}</h3>
				<div className="flex tab-toggle"/>
				{zeroTag}
				<button
					className="bp5-button bp5-intent-primary bp5-minimal"
					style={css.buttonMinimal}
					type="button"
					hidden={!this.props.minimal || open}
					disabled={this.state.disabled}
					onClick={this.onRenew}
				>
					Renew
				</button>
				{deleteButton}
			</button>
		} else {
			header = <div
				className="bp5-card-header layout horizontal tab-toggle"
				style={css.header}
			>
				<h3
					className="tab-toggle"
					style={css.headerLabel}
				>{zero.formattedNameShort() || 'Profile'}</h3>
				<div className="flex tab-toggle"/>
				{zeroTag}
				{deleteButton}
			</div>
		}

		return <div className="bp5-card layout vertical" style={css.card}>
			{header}
			<div style={css.box} hidden={this.props.minimal && !open}>
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
				<div style={css.message} hidden={!this.state.message}>
					{this.state.message}
				</div>
				<div className="layout horizontal">
					<div style={css.buttons}>
						<button
							className="bp5-button bp5-intent-primary bp5-icon-refresh"
							style={css.button}
							type="button"
							hidden={this.state.renewing}
							disabled={this.state.disabled}
							onClick={this.onRenew}
						>
							Renew Certificate
						</button>
						<button
							className="bp5-button bp5-intent-danger bp5-icon-cross"
							style={css.button}
							type="button"
							hidden={!this.state.renewing}
							onClick={this.onCancelRenew}
						>
							Cancel
						</button>
						<button
							className="bp5-button bp5-minimal bp5-icon-id-number"
							style={css.button}
							type="button"
							hidden={!zero.ssh_card_serial}
							disabled={this.state.disabled}
							onClick={this.onRegister}
						>
							Register Card
						</button>
						<button
							className="bp5-button bp5-minimal bp5-icon-reset"
							style={css.button}
							type="button"
							hidden={!zero.ssh_card_serial}
							disabled={this.state.disabled}
							onClick={this.onResetGpg}
						>
							Reset GPG
						</button>
					</div>
				</div>
			</div>
		</div>;
	}
}
