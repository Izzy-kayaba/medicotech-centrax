# Firebase setup and deployment

This guide takes a technical maintainer from a new Firebase project to a live MedicoTech site with News administration. You need access to this repository, a Google account, and control of the domain if you want a custom address.

## 1. Create a project

1. Sign in at https://console.firebase.google.com/ and select **Add project**. Name it, for example, MedicoTech Website. Analytics is not needed by this app.
2. Create the project and record its permanent **Project ID** in Project settings. Replace YOUR_PROJECT_ID in commands below.
3. Choose Firestore and Storage regions carefully. Locations usually cannot be changed later without creating services and moving data; select an approved region for the client.
4. Under Project settings → General → Your apps, register a Web app named MedicoTech Website. Copy its web configuration into js/firebase-config.js: apiKey, authDomain, projectId, storageBucket, messagingSenderId, and appId. Keep the file structure and property names. Set useEmulators to false for production. Never place service-account private keys in browser code.

## 2. Enable the required Firebase services

**Authentication:** Build → Authentication → Get started → Sign-in method. Enable Email/Password. Do not enable public registration. In Settings → Authorized domains, confirm the Firebase Hosting domain; add the custom domain after connecting it in Step 7.

**Firestore:** Build → Firestore Database → Create database. Choose Production mode and the default database. Use the repository's firestore.rules for access protection. The app stores articles in the articles collection. Public users can read published articles; News administrators alone can create, edit, and delete them.

**Storage (for media):** Build → Storage → Get started. Create the default bucket. Prefer a region near Firestore where available. Continued Cloud Storage for Firebase use currently requires the Blaze pay-as-you-go plan; link the client-approved billing account. Configure Google Cloud budget alerts; alerts notify but do not cap charges. Confirm storageBucket in js/firebase-config.js exactly matches the new bucket.

Images and video are optional; text-only articles work without media. The editor and storage.rules limit images to two JPEG/PNG/WebP files per article, 5 MiB each, and video to one MP4/WebM file up to 50 MiB. Video is not transcoded; playback depends on browser codec support. Failed uploads do not stop article text saving, and failed video replacement keeps the previous video. Files are publicly readable, so only upload media intended for public viewing. Storage and video downloads may incur charges.

## 3. Install tools and connect the CLI

1. Install supported Node.js LTS, Git, and Google Cloud CLI (the latter is needed for administrator permission).
2. Open PowerShell in the repository root, containing package.json and firebase.json.
3. Install dependencies and sign in:

   ~~~powershell
   npm install
   npx firebase login
   npx firebase projects:list
   ~~~

4. Confirm the project appears and matches projectId in js/firebase-config.js. Deployment commands explicitly select the project, so a .firebaserc alias is not required.

## 4. Create administrator accounts

Each editor needs an individual account; do not share logins.

1. Firebase Console → Authentication → Users → Add user. Enter their email and temporary strong password; send it securely.
2. Open the user record and copy the UID.
3. Sign in for server-side project access:

   ~~~powershell
   gcloud auth application-default login
   ~~~

4. From the repository root grant News access:

   ~~~powershell
   npm run admin:grant -- YOUR_PROJECT_ID USER_UID grant
   ~~~

5. The administrator signs in at /admin/login. If permission is missing, sign out and back in to refresh the token. To revoke access, run:

   ~~~powershell
   npm run admin:grant -- YOUR_PROJECT_ID USER_UID revoke
   ~~~

Revoking the News permission does not delete the Firebase Authentication account.

## 5. Deploy site and rules

From the repository root:

~~~powershell
npx firebase deploy --project YOUR_PROJECT_ID
~~~

firebase.json runs the prepare:hosting script to generate public/ and deploys Hosting, firestore.rules, firestore.indexes.json, and storage.rules. Check the selected project before confirming. Wait for success, then open the printed https://PROJECT_ID.web.app address. Check the homepage, /news, and /admin/login.

## 6. Connect custom domain and DNS

The web.app address works without a custom domain.

1. Firebase Console → Hosting → Add custom domain. Enter the exact name, such as www.example.com. Add root and www separately if both should work.
2. Copy the exact verification and Hosting DNS records Firebase displays into the DNS provider managing the domain's nameservers. Do not guess values or reuse another project's records.
3. Remove conflicting old website records only after confirming what they point to. Preserve MX and email TXT records if the domain handles email.
4. Return to Hosting and wait for verification and HTTPS certificate provisioning. DNS propagation can take time.
5. Add the custom domain under Authentication → Settings → Authorized domains. Test the HTTPS site, /news, /admin/login, and sign-in.

## 7. Manage articles and maintain the site

Editors visit https://YOUR_DOMAIN/admin. Choose Add New Article or Edit, enter title/body/date, and save to publish immediately. Images/video are optional. Select an MP4 or WebM video no larger than 50 MiB, check the preview, and use Remove current video to remove it. After saving, check News and the article page. Delete only articles that should be permanently removed; sign out on shared devices.

Keep project-owner access limited to maintainers; editors need only News permission. Back up Firestore before major changes and retain original media separately when required. Monitor Storage use, downloads, and billing. Deploy reviewed source and matching rules using the command above.

Troubleshooting: for sign-in, check Email/Password, authorized domains, account existence, and the newsAdmin permission. For media, check bucket creation, billing, storageBucket, editor permission, and deployed Storage rules. For local preview run npm run emulators from the repository root; it uses local data, requires Java, and does not deploy to production.

## Official Firebase guides

- [Create/manage projects](https://firebase.google.com/docs/projects/learn-more)
- [Add a web app](https://firebase.google.com/docs/web/setup)
- [Hosting quickstart](https://firebase.google.com/docs/hosting/quickstart)
- [Custom domains](https://firebase.google.com/docs/hosting/custom-domain)
- [Email/password sign-in](https://firebase.google.com/docs/auth/web/password-auth)
- [Custom claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Cloud Storage](https://firebase.google.com/docs/storage)
