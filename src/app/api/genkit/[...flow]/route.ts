// src/app/api/genkit/[...flow]/route.ts
import { appRoute } from '@genkit-ai/next';
import '@/ai/flows/align-content';

// With the native Firebase Genkit integration, we just need to export appRoute()
// and ensure our flow files are imported somewhere in the server build.
// Firebase will automatically discover and serve the defined flows.
export const POST = appRoute();
