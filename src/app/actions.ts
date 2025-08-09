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

// Mock database call to get influencer's personal branding
async function getPersonalBranding(): Promise<string> {
    // In a real app, this would fetch the logged-in user's settings from Firestore.
    // For this example, we'll return a mock personal branding profile.
    return `
        Tone of Voice: Amigável e Inspirador.
        Expertise: Marketing Digital, Vendas, Liderança.
        Value Proposition: Ofereço dicas práticas e insights do mundo real para ajudar outros profissionais a crescerem.
        Current Position: Gerente de Marketing.
    `;
}


const AlignContentActionSchema = z.object({
  content: z.string().min(1, { message: 'O conteúdo não pode estar vazio.' }),
  companyId: z.string(),
  format: z.enum(['linkedin', 'text-heavy', 'hybrid']),
  length: z.enum(['short', 'medium', 'long']),
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
      format: formData.get('format'),
      length: formData.get('length'),
    });

    if (!validatedData.success) {
      return { error: validatedData.error.errors.map((e) => e.message).join(', ') };
    }

    const { content, companyId, format, length } = validatedData.data;

    const companyProfile = await getCompanyProfile(companyId);

    if (!companyProfile) {
        return { error: 'Perfil da empresa não encontrado.' };
    }

    const personalBranding = await getPersonalBranding();

    const result = await alignContent({ 
        content, 
        companyProfile,
        personalBranding,
        format,
        length
    });

    return { alignedContent: result.alignedContent, error: null };
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    return { error: `Ocorreu um erro ao alinhar o conteúdo: ${errorMessage}`, alignedContent: null };
  }
}
