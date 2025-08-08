'use server';

import { alignContent } from '@/ai/flows/align-content';
import { z } from 'zod';

// Mock database call to get company profile
async function getCompanyProfile(companyId: string): Promise<string> {
  // In a real application, this would fetch data from Firestore.
  // For this example, we'll return a mock profile based on the ID.
  console.log(`Fetching profile for company: ${companyId}`);
  if (companyId === 'company-123') {
    return `
      Company Name: Brand Advocate Hub
      Tagline: Turning Employees into Brand Influencers.
      Target Audience: Internal employees of our client companies.
      Tone of Voice: Encouraging, motivating, and professional.
      Key Messages: Emphasize participation, learning, and brand advocacy.
    `;
  }
  return 'Generic company profile: be friendly and professional.';
}

const AlignContentActionSchema = z.object({
  content: z.string().min(1, { message: 'O conteúdo não pode estar vazio.' }),
  companyId: z.string(),
});

type AlignContentState = {
  alignedContent?: string | null;
  error?: string | null;
};

export async function handleAlignContent(
  prevState: AlignContentState,
  formData: FormData
): Promise<AlignContentState> {
  try {
    const validatedData = AlignContentActionSchema.safeParse({
      content: formData.get('content'),
      companyId: formData.get('companyId'),
    });

    if (!validatedData.success) {
      return { error: validatedData.error.errors.map((e) => e.message).join(', ') };
    }

    const { content, companyId } = validatedData.data;

    const companyProfile = await getCompanyProfile(companyId);

    if (!companyProfile) {
        return { error: 'Perfil da empresa não encontrado.' };
    }

    const result = await alignContent({ content, companyProfile });

    return { alignedContent: result.alignedContent, error: null };
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    return { error: `Ocorreu um erro ao alinhar o conteúdo: ${errorMessage}`, alignedContent: null };
  }
}
