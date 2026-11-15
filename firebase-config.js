// Egodact Addon Marketplace - Firebase (developer portal) config
// 1) Create a Firebase project (2nd Firestore for devs) and enable:
//    - Authentication: Email/Password and Google providers
//    - Firestore Database
// 2) Paste your web app config below.
// 3) Set MAINTAINER_UIDS and/or MAINTAINER_EMAILS so only you can approve/reject.
// Firestore collections used:
//   submissions/{autoId}  - developer submissions (pending/approved/rejected)
//   published/{addonId}   - approved addons shown in marketplace/extension
//   admins/{uid}          - optional; if exists, treated as maintainer (alternative to lists below)
(function () {
  'use strict';
  window.EgodactMarketplaceFirebase = {
    config: {
      apiKey: "PASTE_API_KEY",
      authDomain: "PASTE_PROJECT.firebaseapp.com",
      projectId: "PASTE_PROJECT_ID",
      storageBucket: "PASTE_PROJECT_ID.appspot.com",
      messagingSenderId: "PASTE_SENDER_ID",
      appId: "PASTE_APP_ID"
    },
    // Maintainer access for admin review UI (client-side gate; secure data with Firestore rules too)
    MAINTAINER_UIDS: [
      // "your-firebase-auth-uid"
    ],
    MAINTAINER_EMAILS: [
      // "you@example.com"
    ]
  };
})();
