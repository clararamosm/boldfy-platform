// src/app/api/genkit/[...flow]/route.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { NextRequest } from 'next/server';
import {-next-plugin} from '@genkit-ai/next';

import '@/ai/flows/align-content';

const { POST } = -next-plugin({
  plugins: [
    googleAI(),
  ],
});

export { POST };
