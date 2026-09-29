# MedicoTech Website

This repository contains the MedicoTech public website and its News article management area. Public pages use HTML, CSS and browser JavaScript. Firebase provides website hosting, News sign-in, article data and optional article images.

## Project contents

- Public pages are HTML files in the project root; shared styles are in `styles/`, browser scripts in `js/`, and images in `assets/`.
- The News management area is in `admin/`. Editors open it at `/admin` on the deployed site.
- Article data is stored in the Firestore `articles` collection. Starting article content is in `data/news.json`.
- Firebase configuration is in `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `storage.rules` and `js/firebase-config.js`.
- `public/` is generated for deployment. Edit the source files, not generated files in `public/`.

## Requirements

- Node.js 22 or later and npm.
- Firebase project access for deployment. This project is currently configured for `medicotech-website`; confirm the target before publishing.
- Java 21 or later and Google Chrome for local Firebase service tests.

## Install and run locally

Open a terminal in the folder containing `package.json` and `firebase.json`, then install dependencies:

```powershell
npm.cmd install
npm.cmd run emulators
```

The local Hosting preview uses port 5000. Auth, Firestore and Storage emulators use ports 9099, 8080 and 9199. Emulator data uses the demo project ID `demo-medicotech-news`, separate from production.

## Firebase and News access

The public browser settings in `js/firebase-config.js` identify the Firebase project; they are expected to be visible to visitors. Never put service-account keys, private credentials or passwords there or in website assets.

The site uses Firebase Hosting, Firebase Authentication with Email/Password, and Cloud Firestore. Cloud Storage is optional for News images. Firestore and Storage rules restrict changes to accounts with the `newsAdmin` permission. Firebase project access is separate; most News editors only need the `/admin` workspace.

The admin workspace manages News articles only. Saving publishes immediately; future scheduling and private drafts are not supported. Articles can have up to two optional JPEG, PNG or WebP images (5 MB maximum each).

A technical maintainer creates each editor in Firebase Authentication and grants News access with:

```powershell
npm.cmd run admin:grant -- medicotech-website CLIENT_USER_UID grant
```

Replace `grant` with `revoke` to remove News editing access. For complete Firebase setup, custom-domain instructions, administrator provisioning, article editing, billing and handover checks, see [FIREBASE-CLIENT-HANDOVER.md](FIREBASE-CLIENT-HANDOVER.md).

## Useful commands

Prepare website files for deployment:

```powershell
npm.cmd run prepare:hosting
```

Run Firestore and Storage rules checks using emulators:

```powershell
npm.cmd test
```

Run the browser workflow against emulators (requires Chrome):

```powershell
npm.cmd run test:browser
```

Deploy Firestore rules and index:

```powershell
npx.cmd firebase deploy --only firestore --project medicotech-website
```

Deploy Storage rules if image uploads are enabled:

```powershell
npx.cmd firebase deploy --only storage --project medicotech-website
```

Deploy the website:

```powershell
npx.cmd firebase deploy --only hosting --project medicotech-website
```

Sign in to Firebase CLI first with `npx.cmd firebase login`. Always verify the project ID before deploying. Hosting deployment prepares a fresh `public/` folder automatically.

## Changes and support

Checked-in source files and Firebase configuration are the project's source of truth. `public/` is generated output. Changes to source rules and settings are not live until deployed.

For a live-site problem, record the page address, action taken and exact error message, then contact the technical maintainer. Never include passwords, service-account keys or other private credentials in support requests.
