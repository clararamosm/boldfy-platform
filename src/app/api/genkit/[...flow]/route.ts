// src/app/api/genkit/[...flow]/route.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { NextRequest } from 'next/server';
import {nextPlugin} from '@genkit-ai/next';

import '@/ai/flows/align-content';

const { POST } = nextPlugin({
  plugins: [
    googleAI(),
  ],
});

export { POST };
