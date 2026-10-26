// Local packaging script for the auto-auth fork.
// Builds an ad-hoc signed app bundle that reuses the Pritunl signed helper
// binaries shipped with the installed app.
//
// The app is ad-hoc signed, so it needs the
// com.apple.security.cs.disable-library-validation entitlement. The Pritunl
// signed helper binaries are left untouched so device authentication keeps
// its original code signature.

const packager = require('@electron/packager');
const { signAsync } = require('@electron/osx-sign');
const path = require('path');
const fs = require('fs');
const os = require('os');

const appName = 'Pritunl';
const arch = 'arm64';
const outDir = 'build-local';
const appDir = path.join(outDir, `${appName}-darwin-${arch}`, `${appName}.app`);
const entitlements = path.resolve('entitlements.plist');

const home = os.homedir();
const sourceCandidates = [
	path.join(home, 'Pritunl-1.4.4791.77.app'),
	path.join(home, 'Pritunl-1.4.4777.90.app'),
	path.join(home, 'Pritunl-1.4.4752.50.app'),
	'/Applications/Pritunl.app',
];
const sourceApp = process.env.PRITUNL_SOURCE_APP ||
	sourceCandidates.find((candidate) => fs.existsSync(candidate)) ||
	'/Applications/Pritunl.app';

// These binaries are signed by Pritunl and must not be re-signed, otherwise
// the secure enclave key ACL used by device authentication stops matching.
const pritunlSigned = (filePath) => {
	const rel = path.relative(appDir, filePath);
	return rel === path.join('Contents', 'Resources', 'pritunl-client') ||
		rel === path.join('Contents', 'Resources',
			'Pritunl Device Authentication') ||
		rel === path.join('Contents', 'MacOS', 'pritunl-service-helper');
};

function copyFile(src, dst, mode) {
	fs.mkdirSync(path.dirname(dst), {recursive: true});
	fs.copyFileSync(src, dst);
	fs.chmodSync(dst, mode);
}

async function main() {
	console.log('Using Pritunl binaries from:', sourceApp);

	const appPaths = await packager({
		dir: './',
		name: appName,
		appBundleId: 'com.electron.pritunl',
		platform: 'darwin',
		arch: arch,
		icon: './www/img/pritunl',
		darwinDarkModeSupport: true,
		asar: true,
		prune: false,
		overwrite: true,
		out: outDir,
		gatekeeperAssess: false,
		ignore: [
			/^\/node_modules($|\/)/,
			/^\/dist-dev($|\/)/,
			/^\/build-local($|\/)/,
			/^\/\.git($|\/)/,
			/^\/entitlements\.plist$/,
			/^\/package_local\.js$/,
		],
		extraResource: [
			path.join(sourceApp, 'Contents', 'Resources', 'pritunl-client'),
			path.join(sourceApp, 'Contents', 'Resources',
				'Pritunl Device Authentication'),
		],
	});

	const app = appDir;
	console.log('Packaged:', app);

	copyFile(path.join(sourceApp, 'Contents', 'MacOS',
		'pritunl-service-helper'),
		path.join(app, 'Contents', 'MacOS', 'pritunl-service-helper'), 0o755);

	copyFile(path.join(sourceApp, 'Contents', 'Library', 'LaunchDaemons',
		'com.pritunl.service.plist'),
		path.join(app, 'Contents', 'Library', 'LaunchDaemons',
			'com.pritunl.service.plist'), 0o644);

	console.log('Signing ad-hoc');
	await signAsync({
		app: app,
		identity: '-',
		identityValidation: false,
		hardenedRuntime: true,
		entitlements: entitlements,
		optionsForFile: () => ({entitlements: entitlements}),
		// Must be a function, not an array: osx-sign drops array values.
		ignore: pritunlSigned,
	});

	console.log('Done:', app);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
