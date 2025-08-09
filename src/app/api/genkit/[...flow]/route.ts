// src/app/api/genkit/[...flow]/route.ts
import { appRoute } from '@genkit-ai/next';
import { alignContentFlow } from '@/ai/flows/align-content-flow'; // Assuming the flow is exported from here
import { firebaseAuth } from '@genkit-ai/firebase/auth';

// By naming the file [...flow], we can handle different flows based on the path.
// For this example, we'll assume a single flow for simplicity, but you can expand this.

export const POST = appRoute({
  flow: alignContentFlow,
  auth: {
     // This uses the Firebase auth integration to verify the user.
     // It checks for a valid Firebase Auth ID token in the Authorization header.
    firebase: true,
  },
  // Optionally, you can add CORS configuration if your client is on a different domain.
  // cors: {
  //   origin: '*',
  // },
});
