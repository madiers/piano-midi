# Making the app "proper" — code signing

> **Written for:** whoever maintains this repo — practical steps, not background reading.

Today's builds are unsigned. That is why macOS says *"Apple could not verify
'Piano MIDI' is free of malware"* and Windows shows a SmartScreen warning. The
warning is about **provenance, not content**: macOS is saying it cannot tell who
built this or prove it hasn't been altered since — not that it found anything.

Nothing in the code needs to change to fix it. The build already reads signing
credentials from CI secrets and turns everything on the moment they exist.

---

## What signing actually buys

| | Unsigned (today) | Signed + notarized |
|---|---|---|
| macOS first launch | Gatekeeper blocks; user clicks through System Settings | Opens normally |
| macOS auto-update | ❌ Impossible — Squirrel.Mac validates the signature | ✅ Silent background updates |
| Windows install | SmartScreen "unknown publisher" | Clean |
| Windows auto-update | ✅ Already works | ✅ Works |
| Linux | ✅ Already fine | ✅ Fine |

The macOS auto-update row is the real prize. It is not a policy choice — an
unsigned mac app *cannot* replace itself, because Squirrel.Mac refuses to swap
in a build whose signature is missing or doesn't match.

---

## macOS — Apple Developer Program

**Cost:** $99/year. **Lead time: start early.** Enrolment is not instant — it
routinely takes days and can stall on identity verification. Enrol before doing
any of the CI work.

### 1. Enrol
<https://developer.apple.com/programs/enroll/> — as an Individual unless you
want the company name shown, which needs a D-U-N-S number and takes longer.

### 2. Create a **Developer ID Application** certificate

This is the one for apps distributed outside the App Store. Not "Apple
Development" (that is for local testing — if you have Xcode installed you
probably already have one, and it will **not** work here), and not "Apple
Distribution" (App Store).

In Xcode: *Settings → Accounts → Manage Certificates → + → Developer ID
Application*. Then export it from Keychain Access as a `.p12` with a password.

### 3. Create an app-specific password for notarization

<https://appleid.apple.com> → Sign-In and Security → App-Specific Passwords.
Notarization will not accept your normal Apple ID password.

### 4. Add four GitHub secrets

*Settings → Secrets and variables → Actions*:

| Secret | Value |
|---|---|
| `MAC_CSC_LINK` | the `.p12`, base64-encoded: `base64 -i cert.p12 \| pbcopy` |
| `MAC_CSC_KEY_PASSWORD` | the password you set when exporting the `.p12` |
| `APPLE_ID` | your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | from step 3 |
| `APPLE_TEAM_ID` | 10 characters, from <https://developer.apple.com/account> → Membership |

That is the whole job. The release workflow detects `MAC_CSC_LINK`, signs,
notarizes, staples, and sets `PIANO_MIDI_MAC_SIGNED=1` so the app enables
in-place updates on macOS.

### 5. Tag a release and check it

```bash
npm version patch && git push --follow-tags
```

Download the DMG on a Mac that has never seen the app and confirm it opens with
no warning. Then verify properly:

```bash
spctl -a -vv "/Applications/Piano MIDI.app"     # expect: accepted, source=Notarized Developer ID
codesign -dv --verbose=4 "/Applications/Piano MIDI.app"
xcrun stapler validate "/Applications/Piano MIDI.app"
```

### Entitlements are already set

`build/entitlements.mac.plist` carries the JIT and unsigned-memory entitlements
Chromium needs under the hardened runtime. CoreMIDI input needs **no**
entitlement. If pitch detection through the microphone is ever added, that needs
`com.apple.security.device.audio-input` plus an `NSMicrophoneUsageDescription`
string — add both *before* the first notarization attempt, because notarization
failures are slow to diagnose.

---

## Windows — free, if the project stays open source

[**SignPath Foundation**](https://signpath.org/) gives qualifying open-source
projects free OV code signing, with the key held in their HSM and a CI-integrated
pipeline. No USB token, no annual fee.

Requirements: public repository, recognised OSS licence. This repo is MIT and
public, so it should qualify.

**One caveat worth knowing before you apply:** the certificate is issued to
*SignPath Foundation*, so that — not your name — is the publisher users see, and
that is the string that would go in electron-builder's `publisherName`.

Paid alternatives, if you would rather be the named publisher:

- **Azure Artifact Signing** (formerly Trusted Signing) — about $10/month,
  cheapest real option, and electron-builder supports it via `azureSignOptions`.
- **OV certificate** from a CA — roughly $100–400/year. Note that certificate
  lifetimes dropped to 460 days on 2026-03-01 (CA/Browser Forum ballot CSC-31),
  so renewals come round faster than they used to.

Once you have one, add `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` as secrets. The
workflow picks them up with no other change.

> Windows auto-update already works unsigned, because electron-updater skips the
> Authenticode check when no `publisherName` is set. That is current behaviour
> rather than a guarantee — if it ever fails closed, signing becomes mandatory.

---

## Until then

Nothing is broken; the first launch just needs one extra click.

**macOS 15 and later, including 26:**

1. Double-click the app. You get *"Apple could not verify…"*. Click **Done** —
   **not** *Move to Trash*.
2. Open **System Settings → Privacy & Security**, scroll to the **Security**
   section. A line about Piano MIDI being blocked appears, with **Open Anyway**.
3. Click it, confirm, and authenticate.

Only needed once per installed version.

> The old **Control-click → Open** trick no longer works. Apple removed that
> bypass in macOS 15 Sequoia, so any guide still recommending it is out of date.

Or, from a terminal:

```bash
xattr -dr com.apple.quarantine "/Applications/Piano MIDI.app"
```

That strips the flag the browser attached on download, which is what Gatekeeper
keys off. Understand what you are doing before running it on software you did
not build yourself.
