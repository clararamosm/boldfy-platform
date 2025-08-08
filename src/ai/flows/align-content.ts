// src/ai/flows/align-content.ts
'use server';
/**
 * @fileOverview A content alignment AI agent for influencers.
 *
 * - alignContent - A function that handles the content alignment process.
 * - AlignContentInput - The input type for the alignContent function.
 * - AlignContentOutput - The return type for the alignContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const AlignContentInputSchema = z.object({
  content: z.string().describe('The original text content from the user.'),
  companyProfile: z.string().describe('The brand profile to align the content with.'),
});
export type AlignContentInput = z.infer<typeof AlignContentInputSchema>;

const AlignContentOutputSchema = z.object({
  alignedContent: z.string().describe('The refined text content aligned with the company brand.'),
});
export type AlignContentOutput = z.infer<typeof AlignContentOutputSchema>;

export async function alignContent(input: AlignContentInput): Promise<AlignContentOutput> {
  return alignContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'alignContentPrompt',
  input: {schema: AlignContentInputSchema},
  output: {schema: AlignContentOutputSchema},
  prompt: `You are an AI assistant that helps influencers refine their content to align with their company's brand. 

  Please refine the following content to match the following brand profile.

  Brand Profile: {{{companyProfile}}}

  Content: {{{content}}}
  
  Return the refined content.`,
});

const alignContentFlow = ai.defineFlow(
  {
    name: 'alignContentFlow',
    inputSchema: AlignContentInputSchema,
    outputSchema: AlignContentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
