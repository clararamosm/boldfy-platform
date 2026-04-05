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
    // First, query the database to discover which properties exist
    const dbResponse = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
    });

    let dbProperties: Record<string, { type: string }> = {};
    if (dbResponse.ok) {
      const dbData = await dbResponse.json();
      dbProperties = dbData.properties || {};
    }

    // Always include Title (required by Notion)
    const properties: Record<string, unknown> = {
      'Título': {
        title: [{ text: { content: input.titulo } }],
      },
    };

    // Only add properties that exist in the database
    const addSelectIfExists = (name: string, value: string) => {
      if (dbProperties[name] && dbProperties[name].type === 'select') {
        properties[name] = { select: { name: value } };
      }
    };

    const addRichTextIfExists = (name: string, value: string) => {
      if (dbProperties[name] && dbProperties[name].type === 'rich_text') {
        properties[name] = { rich_text: [{ text: { content: value.slice(0, 2000) } }] };
      }
    };

    addSelectIfExists('Tipo', input.tipo);
    addSelectIfExists('Página', input.pagina);
    addSelectIfExists('Status', 'Novo');
    addSelectIfExists('Prioridade', 'Média');
    addRichTextIfExists('Descrição', input.descricao);
    addRichTextIfExists('Usuário', `${input.userName || 'Anônimo'} (${input.userEmail || 'sem email'})`);
    addRichTextIfExists('Empresa', input.companyId || 'N/A');

    if (dbProperties['Data'] && dbProperties['Data'].type === 'date') {
      properties['Data'] = { date: { start: new Date().toISOString().split('T')[0] } };
    }

    if (input.imageUrl && dbProperties['Imagem']) {
      if (dbProperties['Imagem'].type === 'files') {
        properties['Imagem'] = { files: [{ type: 'external', name: 'screenshot.png', external: { url: input.imageUrl } }] };
      } else if (dbProperties['Imagem'].type === 'url') {
        properties['Imagem'] = { url: input.imageUrl };
      }
    }

    // Build page content body with all details (as fallback)
    const contentBlocks = [
      { object: 'block' as const, type: 'heading_3' as const, heading_3: { rich_text: [{ type: 'text' as const, text: { content: `${input.tipo}: ${input.titulo}` } }] } },
      { object: 'block' as const, type: 'paragraph' as const, paragraph: { rich_text: [{ type: 'text' as const, text: { content: input.descricao } }] } },
      { object: 'block' as const, type: 'divider' as const, divider: {} },
      { object: 'block' as const, type: 'paragraph' as const, paragraph: { rich_text: [{ type: 'text' as const, text: { content: `📍 Página: ${input.pagina} | 👤 ${input.userName || 'Anônimo'} (${input.userEmail || ''}) | 🏢 ${input.companyId || 'N/A'} | 📅 ${new Date().toLocaleDateString('pt-BR')}` } }] } },
    ];

    if (input.imageUrl) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (contentBlocks as any[]).push({
        object: 'block', type: 'image', image: { type: 'external', external: { url: input.imageUrl } },
      });
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
        children: contentBlocks,
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
