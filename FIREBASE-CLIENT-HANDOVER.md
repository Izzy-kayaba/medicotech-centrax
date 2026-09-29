# MedicoTech Website: Client Handover and Firebase Setup

This guide walks the client team through launching the MedicoTech website on Firebase, giving staff access to manage News, and looking after the site day to day. It is written for both non-technical staff and the technical person responsible for Firebase.

## What you need to know first

The public website is a static website: its pages are HTML, CSS and JavaScript files. Firebase Hosting publishes those files online. The News editor is available at `/admin`; it is not a general website editor.

Firebase services used by this project:

- **Firebase Hosting** publishes the website and provides a secure `web.app` address, with the option to connect the client's own domain.
- **Firebase Authentication** checks a News editor's email address and password.
- **Cloud Firestore** (the online database) stores article text, dates, publication status and image references.
- **Cloud Storage** stores optional article images. News works without images or Storage.
- **Security Rules** are server-side access checks. They allow public visitors to read published articles, while only approved News editors can change articles or upload images.

The current website configuration points to Firebase project ID `medicotech-website` and Storage bucket `medicotech-website.firebasestorage.app`. Confirm with the client that this is the intended production project before deploying. A project ID is Firebase's permanent identifier for a project.

> **Who should do what?** Client News editors can follow Sections 6 and 7 without using a terminal. A technical maintainer should complete project setup, deployment, account approval, and ongoing technical maintenance.

## Handover agenda

Suggested meeting: 60–90 minutes. Have the technical maintainer share their screen for the setup and access steps; then let each client editor practise publishing and editing a test article.

1. Confirm the production website address, Firebase project, client contacts and who will be the technical owner.
2. Explain the four Firebase services and distinguish website editing access from Firebase project access.
3. Review the Hosting address and connect the client's domain if the DNS owner is present.
4. Check Authentication, Firestore and optional Storage setup.
5. Create individual client accounts and grant News editing access.
6. Demonstrate adding, editing, checking and deleting a News article.
7. Agree on content approval, account changes, technical support, billing review and incident contacts.
8. Record the final Hosting address, admin link, project ID, named account owners and outstanding setup items in the handover record.

Do not put passwords, private keys or recovery codes in this guide or the handover record. Share credentials using the client's approved password manager.

## 1. Prepare the technical maintainer's computer

Do these steps on the computer used to deploy the site.

1. Install **Node.js 22 or later** (the JavaScript runtime used by the project's setup scripts) and Git if they are not already installed.
2. Open PowerShell in the project folder. It is the folder containing `package.json` and `firebase.json`.
3. Install the project's tools and sign in to Firebase:

```powershell
node --version
npm.cmd install
npx.cmd firebase login
npx.cmd firebase projects:list
```

The project list should include the Firebase project the client approved. Use a Google account that the client has authorised to deploy this website. Signing in to the CLI does not give a News editor account access to Firebase.

The project does not include a `.firebaserc` project alias. For this reason, deployment commands below include `--project medicotech-website` explicitly. If the client chooses another Firebase project, replace that ID consistently and update the website's public Firebase configuration in Section 3.

## 2. Create or confirm the Firebase project

1. A client project owner opens the [Firebase console](https://console.firebase.google.com/) and creates a Firebase project, or selects the existing approved project.
2. Confirm the **Project ID** under Project settings. For the current website configuration it should be `medicotech-website`.
3. Set the project's default resource location carefully. Firestore and Storage locations can be difficult or impossible to change after creation. Choose a location suitable for the client's data residency and expected users.
4. Add the technical maintainer as a project member with only the role needed for their work. Keep project-owner access limited to the people responsible for billing and project ownership.
5. Set up a billing budget and alert for the project. An alert is a warning, not a spending cap; review actual usage and billing in the console.

Firebase Hosting can publish the static website on a Firebase-provided `web.app` address. The Hosting quickstart and Firebase CLI guide are linked in [Firebase's Hosting documentation](https://firebase.google.com/docs/hosting/quickstart) and [CLI documentation](https://firebase.google.com/docs/cli).

## 3. Connect the website files to the right Firebase project

The browser uses the public Firebase web-app settings in `js/firebase-config.js`. These settings identify the Firebase project; they are not a service-account key.

1. In Firebase, open **Project settings > General > Your apps**.
2. Add a **Web app** if the project does not already have one. Register it with a recognisable name such as `MedicoTech website`.
3. Copy the web app configuration values into the existing `firebaseConfig` object in `js/firebase-config.js`: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` and `appId`.
4. Check that `projectId` is the intended project ID. If Storage is not being enabled, the bucket can remain unused; if Storage is enabled, copy the exact bucket value supplied by Firebase.
5. Leave `useEmulators = false` for the live website. The emulator setting is for local development only.

Never place a Firebase service-account JSON file, private key, password or other server credential in `js/firebase-config.js` or in the public website folder. The Firebase web configuration is designed to be visible in a browser; Firestore and Storage Security Rules are what control data access.

## 4. Enable the required Firebase services

### 4.1 Enable email and password sign-in

1. In Firebase, open **Authentication** and choose **Get started** if prompted.
2. Open **Sign-in method** (the console may label this under **Security > Authentication**).
3. Enable **Email/Password** and save.
4. Open Authentication's **Settings > Authorized domains** and add the website's real domain, including the domain Firebase assigned if it will be used. Add a Vercel demo domain only if that demo should authenticate against this same Firebase project.

Authentication checks the login. It does not, by itself, grant permission to edit News. The project uses a separate `newsAdmin` permission described in Section 5. This site has no public registration or password-reset form; the maintainer creates accounts and handles password assistance in Firebase Authentication.

See [Firebase email/password sign-in documentation](https://firebase.google.com/docs/auth/web/password-auth).

### 4.2 Create or confirm Cloud Firestore

1. In Firebase, open **Firestore Database** and create the default database if it does not exist.
2. Choose **Production mode** and the approved location. Do not start with open test rules.
3. From the project folder, deploy this website's Firestore rules and index:

```powershell
npx.cmd firebase deploy --only firestore --project medicotech-website
```

The rules in `firestore.rules` make published articles readable by visitors, allow article changes only for accounts with the `newsAdmin` permission, and deny access to other database collections. The index in `firestore.indexes.json` supports showing published articles newest first. In Firebase, check that the index has finished building before judging the News page.

If the Firebase project already contains data for another application, ask the technical owner to review and combine the rules first. Deploying this project's rules replaces the Firestore rules for the selected database; it must not accidentally remove rules required by another application.

### 4.3 Optional: enable Cloud Storage for News images

Skip this section if the client is happy to publish text-only articles. The News editor can publish without Storage.

1. In Firebase, open **Storage** and create a bucket if one does not exist.
2. Cloud Storage for Firebase currently requires the **Blaze pay-as-you-go plan**, including for default buckets. Review the pricing, link the client's billing account if approved, and create budget alerts before enabling image uploads. An alert does not stop charges. See Firebase's current [Storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).
3. Copy the exact bucket name shown in Firebase into the `storageBucket` field in `js/firebase-config.js`. The current code is configured for `medicotech-website.firebasestorage.app`; do not guess the bucket name or add a `gs://` prefix.
4. Deploy the Storage rules:

```powershell
npx.cmd firebase deploy --only storage --project medicotech-website
```

The rules only allow approved News editors to upload or delete article images. Images must be JPEG, PNG or WebP and no larger than 5 MB each. Each article supports up to two optional image slots.

## 5. Create client administrators and approve News access

There are two different kinds of administrator access:

- A **News editor account** can sign in to `/admin` and manage articles only.
- A **Firebase project member** can manage technical Firebase settings and data in the Firebase console.

Most client staff need only a News editor account. Do not give someone Firebase project-owner access just so they can edit News. Create one named account per person; do not share a single login.

### 5.1 Create each News editor's account

1. In Firebase, open **Authentication > Users**.
2. Select **Add user** and enter the person's work email and a temporary password. Give the password to the person using the client's approved password manager or another secure channel.
3. Open the new user record and copy its **UID** (unique user ID). The UID is not the email address.
4. Repeat for each authorised editor. Confirm names and access with the client's project owner before granting the permission.

### 5.2 Grant the News editing permission

The technical maintainer must run the approval script from the project folder. It uses **Application Default Credentials** (the Google identity used by the Google Cloud tools) and the Firebase Admin SDK (server-side Firebase management tools); it is separate from the client's email/password login.

1. Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install), if needed.
2. Sign in with a Google account that the client has authorised to manage Firebase Authentication users:

```powershell
gcloud auth application-default login
```

3. Grant the person News access, replacing `CLIENT_USER_UID` with the UID from Firebase Authentication:

```powershell
npm.cmd run admin:grant -- medicotech-website CLIENT_USER_UID grant
```

The script adds `newsAdmin: true` to the account's permission claims while keeping its other claims. A **claim** is a small trusted permission attached to the user's Firebase sign-in token. Ask the editor to sign out and sign in again so the new permission is picked up.

To remove News access later, run:

```powershell
npm.cmd run admin:grant -- medicotech-website CLIENT_USER_UID revoke
```

The revoke option also revokes the user's refresh tokens. Ask the person to sign in again only if they still have other authorised access. Keep a dated record of who approved each grant or removal, but do not record passwords.

If the client chooses a different Firebase project, replace `medicotech-website` in these commands with its exact project ID. The maintainer account needs permission in that same project.

## 6. Publish the website on Firebase Hosting

This project prepares a clean `public/` folder before deploying. The preparation script copies the website's HTML, CSS, JavaScript, images and admin pages; it excludes development files. The generated `public/` folder is not the place to make edits.

1. Confirm the Firebase web app settings in Section 3 and the service setup in Section 4.
2. From the project folder, deploy the website to the confirmed production project:

```powershell
npx.cmd firebase deploy --only hosting --project medicotech-website
```

Firebase runs the configured `prepare:hosting` step before Hosting deployment. When the command finishes, copy the Hosting URL it prints, usually `https://medicotech-website.web.app`, and open it in a browser.

3. Open the public pages, then open `https://YOUR_HOSTING_DOMAIN/admin`. Confirm the login page appears and that the approved editor can sign in.
4. If a custom domain is required, in Firebase open **Hosting > Add custom domain** and follow the wizard. The client's domain owner must add the exact DNS records Firebase displays. Wait until Firebase reports the domain as connected and its secure certificate is ready.
5. Add the final custom domain to Authentication's authorized domains (Section 4.1).

Do not copy example DNS records from another site; use the records shown by the Firebase console for this exact domain. See [Firebase's custom-domain guide](https://firebase.google.com/docs/hosting/custom-domain).

The Vercel demo is a separate deployment and may use the same Firebase settings. If it points at the production project, News edits made through the demo change the production articles too. Agree with the client whether to keep it, and make clear which address is production. The GitHub Pages workflow is also separate; it does not publish Firebase rules or configure the clean admin routes.

## 7. Day-to-day News editing for client staff

These tasks do not require Firebase console access or coding. Use the production website address supplied at handover and add `/admin`, for example:

```text
https://YOUR_WEBSITE_DOMAIN/admin
```

### Sign in

1. Enter your individual work email and password.
2. Select **Log in**. The workspace lists published articles.
3. If you see an editing-permission message, contact the technical maintainer. They need to confirm your account and `newsAdmin` permission.

There is no self-registration or password-reset link on this screen. Do not send your password to the support person; they can help through Firebase.

### Add an article

1. Select **Add New Article**.
2. Enter a short, clear **Article title** (up to 200 characters).
3. Enter the article in **Article content**. Leave a blank line between paragraphs. You may use `## Heading`, `### Smaller heading` and lines beginning `- ` for a list.
4. Choose a publication date that is today or earlier.
5. Optionally choose up to two JPEG, PNG or WebP images, each 5 MB or smaller. Use images the organisation has permission to publish and that do not expose private or sensitive information.
6. Select **Save / Publish** and wait for the success message.
7. Select **View website**, find the article in News, open it and check its title, date, text and images.

Saving publishes the article immediately. The chosen date controls its position in the News list; it does not schedule the article for a future date. There is no private draft or automatic saving. Prepare text elsewhere before starting if you are not ready to publish.

### Edit an article

1. Find the article under **Your articles** and select **Edit**.
2. Update its title, content or publication date.
3. To replace an image, choose a new file in that image slot. The old image remains if the replacement fails.
4. To remove an image, select **Remove current image 1** or **Remove current image 2**. The removal takes effect only after a successful save.
5. Select **Save / Publish**, then check the result on the News page.

If the editor warns that another session changed the article, copy your unsaved text elsewhere, reload, and reopen the latest article before editing again. This prevents one person's changes from overwriting another's.

### Delete an article

1. Select **Delete** beside the article.
2. Read the confirmation, then confirm only if the article should be permanently removed.

There is no recycle bin or undo. Keep a separate copy of content the client may need again.

### Log out safely

Select **Log out** when finished, especially on a shared computer. If asked about unsaved changes, choose whether to discard them. Do not save your password in a shared browser.

## 8. Routine platform care

### Each working day

- Review new or edited News articles and confirm the correct title, date, links and images.
- If an article is time-sensitive, confirm the date with the content owner before publishing. Saving makes it public immediately.
- Log out after editing and report login or publishing problems to the technical maintainer.

### Each month

- The project owner reviews Firebase usage, billing and budget alerts.
- The client reviews who still needs News access. Ask the technical maintainer to revoke access for people who have left or changed roles.
- The technical maintainer checks Firebase Hosting, Firestore and (if enabled) Storage status and responds to Firebase service notices.

### When website wording, layout or images outside News need changing

Contact the technical maintainer. The News dashboard changes News articles only; it cannot change the home page, menus, colours, page layout or legal pages. A technical update is made in the source project, reviewed, prepared and deployed to Firebase Hosting. Do not edit files in the generated `public/` folder.

### When an editor joins or leaves

The client owner confirms the person's access. The technical maintainer creates a separate Authentication account and grants the News permission as in Section 5. When access is no longer required, the maintainer revokes the permission and disables or removes the Authentication account according to the client's account-retention process.

### Backups and recovery

News articles are stored in Cloud Firestore. Agree with the technical maintainer how often to export or otherwise back up article content and who is responsible for restoring it. Do not treat the Firebase console as a backup, and do not delete database records or Storage objects as a cleanup shortcut. Coordinate recovery with the technical maintainer.

## 9. Troubleshooting

- **The website does not open:** check the URL and Firebase Hosting status. If a custom domain was just connected, DNS and the secure certificate may still be processing.
- **The login page says the password is wrong:** re-enter the individual account details and check the correct website domain. Ask the maintainer for password assistance; never share the password.
- **Login succeeds but editing is refused:** ask the maintainer to confirm the account UID and `newsAdmin` permission. Sign out and in again after the maintainer grants it.
- **News does not load:** the technical maintainer should confirm that `js/firebase-config.js` points to the correct project, Firestore is enabled, the rules are deployed, and the `articles` index is ready.
- **An article saves with an image warning:** the article text may already be live. Do not create a duplicate. The maintainer should check Storage billing, the configured bucket and Storage rules; the editor can retry the image later.
- **No article appears after saving:** check for the success message, refresh the News page and confirm its date is not in the future. If saving showed an error, copy the article text and contact the maintainer before retrying.
- **A staff member should no longer have access:** ask the maintainer to revoke the News permission and disable or remove the Firebase Authentication account as appropriate.

When reporting a problem, include the page address, approximate time, action attempted and exact error message. Never include passwords, private keys or service-account files.

## 10. Handover completion checklist

- [ ] Client confirms the production Firebase project ID and who owns billing.
- [ ] Hosting URL opens and the custom domain is connected, if required.
- [ ] Authentication Email/Password is enabled and the production domain is authorised.
- [ ] Firestore exists; the site's rules and article index are deployed and ready.
- [ ] Storage is either intentionally not enabled, or the bucket, billing and rules are confirmed.
- [ ] At least one named client editor can sign in and has News editing access.
- [ ] Client has practised adding, checking, editing and deleting a test article.
- [ ] Client understands that saving publishes immediately and there are no drafts or scheduled posts.
- [ ] Client knows how to request account changes and technical support.
- [ ] Technical owner, backup/recovery responsibility and monthly billing review are recorded.

## Reference links

- [Firebase Hosting quickstart](https://firebase.google.com/docs/hosting/quickstart)
- [Firebase CLI reference](https://firebase.google.com/docs/cli)
- [Firebase email/password sign-in](https://firebase.google.com/docs/auth/web/password-auth)
- [Firebase custom claims and access rules](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firebase Hosting custom domains](https://firebase.google.com/docs/hosting/custom-domain)
- [Cloud Storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)

---

The project overview and quick-start instructions are in `README.md`. This handover guide describes the repository's current setup; the technical maintainer must confirm live Firebase settings, billing, rules, index status, domain and deployment in the client's Firebase project before declaring setup complete.
