// Egodact Addon Marketplace - Firebase (developer portal) config
// Configured for egodact-addon-portal
// Firestore collections used:
//   submissions/{autoId}  - developer submissions (pending/approved/rejected)
//   published/{addonId}   - approved addons shown in marketplace/extension
//   admins/{uid}          - optional; if exists, treated as maintainer (alternative to lists below)
(function () {
  'use strict';
  window.EgodactMarketplaceFirebase = {
    config: {
      apiKey: "AIzaSyA05hoZF-iiIGi3eaUtnnkG0HuQGlEbWyw",
      authDomain: "egodact-addon-portal.firebaseapp.com",
      projectId: "egodact-addon-portal",
      storageBucket: "egodact-addon-portal.firebasestorage.app",
      messagingSenderId: "617264725883",
      appId: "1:617264725883:web:fd23dfa7270dad4b8f47de"
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