# Pritunl Client — Auto Auth (macOS & Windows)

A personal, source-built fork of
[Pritunl Client](https://github.com/pritunl/pritunl-client) that stores VPN
credentials in the operating system's secure store and signs in automatically —
including time-based one-time passwords (TOTP).

The goal is simple: when a profile requires a PIN, a password, a TOTP code, or
a combination of them, connect without retyping the credentials every time,
while keeping the secrets out of the profile files.

> This is an independent personal fork. It is not affiliated with, endorsed by,
> or supported by Pritunl, Inc. See [License](#license) before redistributing.

## Why this fork

Pritunl profiles can require a PIN and a TOTP code on every connection. The
upstream client deliberately asks for those credentials interactively. This
fork adds an optional **Auto Auth** section to each profile:

- Stores the PIN, password, optional username, and TOTP secret in the macOS
  Keychain or in Windows DPAPI, never in the profile `.conf` or `.ovpn` files.
- Supports **PIN only**, **TOTP only**, or **PIN + TOTP**. Only the fields you
  fill in are sent.
- Generates TOTP codes locally using RFC 6238 (SHA-1, 30-second period,
  6 digits).
- Can connect a profile automatically when the app starts.
- Falls back to the normal credentials dialog if auto auth fails, so a wrong
  or expired secret does not lock you out.
- Includes a **Test Code** button so you can compare the generated code with
  your authenticator before saving.
- When built from source, includes the bandwidth/traffic charts that are present
  in the upstream source but missing from some prebuilt distribution bundles.

## How it works

```text
Profile settings
      │
      ▼
OS secure store  ──►  AutoAuth.load()
                         │
                         ▼
                build credentials
                (PIN / password / TOTP)
                         │
                         ▼
                  Pritunl daemon
                         │
                         ▼
                    OpenVPN
```

### macOS

The Keychain item is a generic password:

| Field | Value |
| --- | --- |
| Service | `Pritunl Auto Auth` |
| Account | Pritunl profile ID |
| Value | JSON: `enabled`, `password`, `pin`, `secret`, `username`, `auto_connect` |

### Windows

The same JSON is encrypted with Windows DPAPI in the current user's context and
written to:

```text
%APPDATA%\Pritunl\auto-auth\<profile-id>.bin
```

Only the same Windows user account can decrypt the file. The TOTP secret is
never written to the profile.

On connect, the client reads the stored data, determines which authentication
types the profile requires, and builds the password string from the non-empty
fields. For an `otp_pin` profile the result is `PIN + TOTP`; for a TOTP-only
setup it is just the current code.

## Releases

Prebuilt artifacts are published on the
[GitHub Releases](https://github.com/ziyacakmak/pritunl-client-auto-auth/releases)
page:

| Platform | Artifact |
| --- | --- |
| macOS (Apple Silicon) | `Pritunl-AutoAuth-macOS-arm64.zip` |
| Windows (x64 / arm64) | `Pritunl-AutoAuth-1.4.4777.90-setup.exe` |

The macOS app is ad-hoc signed and not notarized. The Windows installer is not
code-signed. Expect Gatekeeper or SmartScreen warnings; verify the SHA-256
checksum attached to the release before running anything.

## Requirements

- macOS (tested on Apple Silicon) or Windows 10/11.
- A Pritunl profile that uses token/password, PIN, and/or TOTP authentication.
- For building: Node.js, npm, and the platform toolchain described below.
- For the optional macOS daemon update: administrator rights.
- For the Windows installer: administrator rights.

The fork is based on Pritunl Client **1.4.4777.90** and was tested against the
matching `com.pritunl.service` daemon on macOS. The client can also run against
an older daemon, but matching versions are recommended.

## Build

### macOS

```sh
git clone https://github.com/ziyacakmak/pritunl-client-auto-auth.git
cd pritunl-client-auto-auth/client

npm ci
sh build.sh
node package_local.js
```

The packaged app is written to:

```text
client/build-local/Pritunl-darwin-arm64/Pritunl.app
```

`package_local.js`:

- packages the web client with Electron;
- copies `pritunl-client`, `Pritunl Device Authentication`, and
  `pritunl-service-helper` from a reference Pritunl app;
- ad-hoc signs the app with `client/entitlements.plist`, including
  `com.apple.security.cs.disable-library-validation`;
- leaves the three Pritunl-signed helper binaries untouched so their
  Developer ID signatures remain valid.

By default the reference app is looked up in this order:

1. `~/Pritunl-1.4.4777.90.app`
2. `~/Pritunl-1.4.4752.50.app`
3. `/Applications/Pritunl.app`

Override it explicitly if needed:

```sh
PRITUNL_SOURCE_APP=/path/to/Pritunl.app node package_local.js
```

### Windows

The Windows build needs Node.js, Go, and
[Inno Setup 6](https://jrsoftware.org/isinfo.php). Run from PowerShell:

```powershell
git clone https://github.com/ziyacakmak/pritunl-client-auto-auth.git
cd pritunl-client-auto-auth

.\tools\build_win_auto_auth.ps1
```

The script builds the Go service and CLI for x64 and arm64, packages the
Electron client for both architectures, and produces:

```text
build\Pritunl-AutoAuth-1.4.4777.90-setup.exe
```

The installer is unsigned. It installs to `Program Files (x86)\Pritunl`,
registers the `pritunl` service, and keeps the existing user profile data.

The release workflow in `.github/workflows/release.yml` builds both platforms on
GitHub Actions when a `v*` tag is pushed.

## Install

### macOS

Back up the current app and profile data first:

```sh
cp -R /Applications/Pritunl.app ~/Pritunl-backup.app
cp -R "$HOME/Library/Application Support/Pritunl" \
  ~/Pritunl-profile-backup
```

Quit Pritunl, replace the app, and verify the signature:

```sh
pkill -f "/Applications/Pritunl.app/Contents/MacOS/Pritunl"

rm -rf /Applications/Pritunl.app
ditto client/build-local/Pritunl-darwin-arm64/Pritunl.app \
  /Applications/Pritunl.app

codesign --verify --deep --strict /Applications/Pritunl.app
```

The bundle identifier remains `com.electron.pritunl`, so the existing
`com.pritunl.service` daemon and its registration continue to work.

#### Daemon

The app bundle contains the client and its helpers, but the privileged daemon
lives in `/Library/PrivilegedHelperTools/pritunl-client`. Updating it is
optional. If you want the daemon to match the client version, install the
official `Pritunl.pkg` from the matching upstream release, or copy the daemon
directory from the official package and restart `com.pritunl.service`.

The daemon runs as root and must keep its Pritunl code signature.

### Windows

Run the installer as administrator and follow the wizard. It replaces an
existing Pritunl installation in `Program Files (x86)\Pritunl` and registers the
service. The app can be started from the Start menu or desktop shortcut.

To build and install from source instead, run the PowerShell build above and
then execute `build\Pritunl-AutoAuth-1.4.4777.90-setup.exe`.

## Configure

1. Open the profile → **Settings** → **Auto Auth**.
2. Enable **Enable Auto Auth**.
3. Enter the fields you need:
   - **Pin** for PIN-based profiles;
   - **TOTP Secret** for TOTP;
   - **Password** for password-based profiles;
   - **Username** only if the profile asks for one.
4. Optionally enable **Connect on App Start**.
5. Click **Save**, then **Test Code** to compare the generated code with your
   authenticator.
6. Click **Connect**.

If the server rejects the automatic credentials, the normal dialog appears and
you can enter them manually.

### Getting the TOTP secret from Google Authenticator

Google Authenticator → **Transfer accounts** → **Export accounts** → select the
account. The exported QR code contains an `otpauth-migration://offline?data=...`
URI. Decode it locally; do not upload the QR code or payload to a third-party
service.

```sh
python3 tools/decode-google-auth-export.py \
  'otpauth-migration://offline?data=...'
```

If you still have the original setup QR code or secret, the base32 secret is
enough.

## Security notes

- The TOTP secret is as sensitive as the second factor. Keep it out of chat,
  screenshots, shell history, and cloud notes.
- On macOS, the Keychain item is created with `/usr/bin/security`, so its ACL
  trusts the `security` command-line tool. Any process running as your macOS
  user can read it with:

  ```sh
  security find-generic-password -s "Pritunl Auto Auth" -a <profile-id> -w
  ```

  This is convenient but is not equivalent to a per-application Keychain ACL.
- On Windows, the DPAPI blob is tied to your Windows user account. Any process
  running as that user can ask DPAPI to decrypt it. Protect your Windows
  account and the `%APPDATA%\Pritunl\auto-auth` directory accordingly.
- The macOS app is ad-hoc signed, not notarized. The Windows installer is
  unsigned. Do not redistribute either build without reviewing the upstream
  license.
- The `Pritunl Device Authentication` helper keeps its original Pritunl
  signature. Device-auth failures such as `unable to sign digest` can appear in
  macOS logs; they do not block token/password-based connections.
- The fork does not log PINs, passwords, TOTP secrets, or generated codes.

## Troubleshooting

### Auto auth does not run

- Confirm **Enable Auto Auth** is on and the profile settings were saved.
- Check that the stored item exists for the profile ID:
  - macOS: `security find-generic-password -s "Pritunl Auto Auth" -a <profile-id>`
  - Windows: check `%APPDATA%\Pritunl\auto-auth\<profile-id>.bin`
- If the profile requires a username, fill in the **Username** field.
- If the profile requires OTP, use both PIN and TOTP; PIN-only may be rejected
  by the server.

### TOTP code is rejected

- Use **Test Code** and compare it with the authenticator at the same moment.
- Make sure the system clock is correct.
- A TOTP code is single-use; do not reuse a code from a previous connection.

### Connection is stuck on “Connecting”

Restart the privileged daemon.

macOS:

```sh
sudo launchctl kickstart -k system/com.pritunl.service
```

Windows (administrator PowerShell):

```powershell
Restart-Service pritunl
```

Then reconnect. If the problem repeats, check the client log and the daemon
state before changing credentials.

### `unable to sign digest`

This is a macOS device-authentication/Secure Enclave error that can occur with
ad-hoc-signed builds. It is logged by the helper but does not prevent
token/password/PIN/TOTP connections.

## Updating from upstream

When a new upstream release is available:

1. Start from the new upstream tag.
2. Carry over the auto-auth changes in:
   - `client/app/utils/AutoAuth.ts`
   - `client/app/utils/Totp.ts`
   - `client/app/utils/ConnectUtils.ts`
   - `client/app/components/Profile.tsx`
   - `client/app/components/ProfileConnect.tsx`
   - `client/app/components/ProfileSettings.tsx`
   - `client/app/components/Profiles.tsx`
3. Rebuild with `sh build.sh` and `node package_local.js` on macOS, or
   `.\tools\build_win_auto_auth.ps1` on Windows.
4. Test PIN-only, TOTP-only, and PIN + TOTP profiles.
5. Keep the previous app and daemon available for rollback.

Build from source rather than relying only on the prebuilt `dist` bundle:
upstream source and published bundles are not always in sync.

## Project layout

| Path | Purpose |
| --- | --- |
| `client/app/utils/AutoAuth.ts` | Keychain / DPAPI storage and credential assembly |
| `client/app/utils/Totp.ts` | RFC 6238 TOTP implementation |
| `client/app/utils/ConnectUtils.ts` | Shared connect and auto-connect helpers |
| `client/app/components/ProfileConnect.tsx` | Auto-auth connect flow and fallback dialog |
| `client/app/components/ProfileSettings.tsx` | Auto Auth settings UI and validation |
| `client/app/components/Profiles.tsx` | Connect-on-app-start handling |
| `client/package_local.js` | macOS packaging and ad-hoc signing |
| `client/entitlements.plist` | Entitlements for the ad-hoc signed macOS app |
| `resources_win/setup-auto-auth.iss` | Inno Setup installer definition |
| `tools/build_win_auto_auth.ps1` | Windows build script |
| `tools/decode-google-auth-export.py` | Local Google Authenticator export decoder |
| `.github/workflows/release.yml` | macOS + Windows release pipeline |

## License

This fork is based on Pritunl Client. The upstream `LICENSE` is a restrictive
personal, non-commercial license: it does not permit reselling or distributing
the software or derivative works. See [LICENSE](LICENSE) for the full terms.

Use this fork for personal purposes only. If you want to reuse or redistribute
it, review the upstream license and obtain permission from the copyright holder
where required.

Upstream project: <https://github.com/pritunl/pritunl-client>
Upstream documentation: <https://client.pritunl.com>
