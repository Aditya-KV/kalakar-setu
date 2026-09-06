import { getAuth } from '@react-native-firebase/auth';

// The native SDK auto-initializes its default app from google-services.json
// (bundled at build time), so there's no config object or persistence setup
// needed here — unlike the Firebase JS SDK.
export const firebaseAuth = getAuth();
