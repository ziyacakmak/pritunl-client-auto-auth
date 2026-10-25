/// <reference path="../References.d.ts"/>
import * as React from 'react';
import * as Electron from 'electron';
import * as Blueprint from '@blueprintjs/core';

interface Props {
	isOpen: boolean;
	onClose: () => void;
}

const GITHUB_URL = 'https://github.com/ziyacakmak/pritunl-client-auto-auth';

const css = {
	paragraph: {
		margin: '0 0 10px 0',
		lineHeight: '1.5',
	} as React.CSSProperties,
	footer: {
		marginTop: '16px',
		display: 'flex',
		justifyContent: 'center',
	} as React.CSSProperties,
};

export default class About extends React.Component<Props, {}> {
	render(): JSX.Element {
		return <Blueprint.Dialog
			title="Hakkında"
			className="about-dialog"
			isOpen={this.props.isOpen}
			usePortal={true}
			portalContainer={document.body}
			onClose={this.props.onClose}
		>
			<div className="bp5-dialog-body">
				<div className="about-name">Ziya Çakmak</div>
				<div className="about-byline">tarafından geliştirildi</div>

				<h3 className="about-title">Otomatik PIN ve OTP</h3>
				<p style={css.paragraph}>
					Pritunl istemcisi için hazırlanmış bir kolaylık eklentisi.
					Bağlantı sırasında istenen PIN, parola ve TOTP doğrulama
					kodlarını sizin yerinize otomatik olarak girer.
				</p>
				<p style={css.paragraph}>
					Kimlik bilgileri profil dosyalarına yazılmaz; yalnızca bu
					cihazda, işletim sisteminin güvenli kimlik bilgisi
					deposunda saklanır. Otomatik giriş başarısız olursa normal
					kimlik bilgisi penceresine geri dönülür.
				</p>

				<div className="about-license">
					<div className="about-license-title">Lisans ve atıf</div>
					<div>
						Bu proje Pritunl Client üzerine kurulmuş bir çataldır.
						Pritunl istemcisinin ve ilgili tüm hakların lisansı
						Pritunl, Inc.'e aittir.
					</div>
					<div style={{marginTop: '8px'}}>
						Bu yazılım yalnızca kişisel kullanım için hazırlanmış
						bir kolaylık eklentisidir; Pritunl, Inc. ile bağlantılı
						değildir ve resmi olarak desteklenmemektedir. Yeniden
						dağıtım veya ticari kullanım için upstream lisansı
						inceleyin ve gerekli izinleri alın.
					</div>
				</div>

				<div style={css.footer}>
					<a
						className="about-link"
						role="button"
						onClick={(): void => {
							Electron.ipcRenderer.send(
								'control', 'open-link', GITHUB_URL);
						}}
					>
						github.com/ziyacakmak/pritunl-client-auto-auth
					</a>
				</div>
			</div>
			<div className="bp5-dialog-footer">
				<div className="bp5-dialog-footer-actions">
					<button
						className="bp5-button bp5-intent-primary"
						type="button"
						onClick={this.props.onClose}
					>Kapat</button>
				</div>
			</div>
		</Blueprint.Dialog>;
	}
}
