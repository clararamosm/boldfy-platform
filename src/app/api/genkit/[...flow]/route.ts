// src/app/api/genkit/[...flow]/route.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { NextRequest } from 'next/server';
import { firebaseAuth } from '@genkit-ai/firebase';
import { startFlowsServer } from '@genkit-ai/next';

import '@/ai/flows/align-content';

const { POST } = startFlowsServer({
  plugins: [
    googleAI(),
  ],
  // This is how you can enable authentication on your flows.
  // We are using Firebase Auth here, but you can configure your own
  // policies as well.
  flowAuth: {
    alignContent: firebaseAuth((user) => !!user.email),
  },
});

export { POST };
