// src/app/api/genkit/[...flow]/route.ts
import { appRoute } from '@genkit-ai/next';
import { alignContentFlow } from '@/ai/flows/align-content';
import { firebaseAuth } from '@genkit-ai/firebase';

// By naming the file [...flow], we can handle different flows based on the path.
export const POST = appRoute({
  flow: alignContentFlow,
  auth: firebaseAuth((user) => {
    if (!user.email_verified) {
      throw new Error("User's email must be verified to run this flow.");
    }
    // You can add more checks here, e.g., for specific roles
    // if (!user.customClaims?.roles?.includes('influencer')) {
    //    throw new Error('User does not have the required role.');
    // }
  }),
  // Optionally, you can add CORS configuration if your client is on a different domain.
  // cors: {
  //   origin: '*',
  // },
});
