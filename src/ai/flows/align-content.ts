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
  personalBranding: z.string().describe("The user's personal branding profile."),
  format: z.enum(['linkedin', 'text-heavy', 'hybrid']).describe('The desired format for the output.'),
  length: z.enum(['short', 'medium', 'long']).describe('The desired length of the output.'),
});
export type AlignContentInput = z.infer<typeof AlignContentInputSchema>;

const AlignContentOutputSchema = z.object({
  alignedContent: z.string().describe('The refined text content aligned with the company brand and personal voice.'),
});
export type AlignContentOutput = z.infer<typeof AlignContentOutputSchema>;

export async function alignContent(input: AlignContentInput): Promise<AlignContentOutput> {
  return alignContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'alignContentPrompt',
  input: {schema: AlignContentInputSchema},
  output: {schema: AlignContentOutputSchema},
  prompt: `You are an AI assistant that helps influencers refine their content to align with their company's brand while maintaining their personal voice.

You will create the perfect post by mixing the Company Brand Profile with the Influencer's Personal Branding.

**Company Brand Profile:**
{{{companyProfile}}}

**Influencer's Personal Branding:**
{{{personalBranding}}}

**User's Original Content:**
{{{content}}}

---

**Task:**
Refine the original content based on the following requirements:
1.  **Format:** {{{format}}}. If "linkedin", use emojis, short paragraphs, and hashtags. If "text-heavy", focus on detailed information with less formatting. If "hybrid", find a balance.
2.  **Length:** {{{length}}}. "short" should be a few sentences, "medium" a couple of paragraphs, and "long" should be more extensive.
3.  **Tone:** The final output must be a seamless blend of the company's professional tone and the influencer's personal style.

Return only the refined content in the alignedContent field.
`,
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
