'use server';

// Server action to send feedback, bugs, and trail suggestions to Notion

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DB_ID = process.env.NOTION_FEEDBACK_DB_ID;

type FeedbackInput = {
  tipo: 'Bug' | 'Feedback' | 'Sugestão de Trilha';
  titulo: string;
  descricao: string;
  pagina: string;
  userName?: string;
  userEmail?: string;
  companyId?: string;
  imageUrl?: string;
};

export async function sendFeedbackToNotion(input: FeedbackInput): Promise<{ success: boolean; error?: string }> {
  if (!NOTION_API_KEY || !NOTION_DB_ID) {
    console.error('Notion credentials not configured');
    return { success: false, error: 'Integração com Notion não configurada.' };
  }

  try {
    const properties: Record<string, unknown> = {
      // Title property (required)
      'Título': {
        title: [{ text: { content: input.titulo } }],
      },
      'Tipo': {
        select: { name: input.tipo },
      },
      'Descrição': {
        rich_text: [{ text: { content: input.descricao.slice(0, 2000) } }],
      },
      'Página': {
        select: { name: input.pagina },
      },
      'Status': {
        select: { name: 'Novo' },
      },
      'Prioridade': {
        select: { name: 'Média' },
      },
      'Usuário': {
        rich_text: [{ text: { content: `${input.userName || 'Anônimo'} (${input.userEmail || 'sem email'})` } }],
      },
      'Empresa': {
        rich_text: [{ text: { content: input.companyId || 'N/A' } }],
      },
      'Data': {
        date: { start: new Date().toISOString().split('T')[0] },
      },
    };

    // Add image if provided
    if (input.imageUrl) {
      properties['Imagem'] = {
        files: [
          {
            type: 'external',
            name: 'screenshot.png',
            external: { url: input.imageUrl },
          },
        ],
      };
    }

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DB_ID },
        properties,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Notion API error:', response.status, errorData);
      return { success: false, error: `Erro ao enviar para o Notion (${response.status}).` };
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending feedback to Notion:', error);
    return { success: false, error: 'Erro de conexão com o Notion.' };
  }
}
