'use server';

// Server actions to send feedback, bugs, trail suggestions, and support requests to Notion

import { db as adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/auth-guard';

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DB_ID = process.env.NOTION_FEEDBACK_DB_ID;
const NOTION_SUPPORT_DB_ID = process.env.NOTION_SUPPORT_DB_ID;

type FeedbackInput = {
  idToken: string;
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
  // Require authentication and use server-side user data (not client-supplied)
  let authUser;
  try {
    authUser = await requireAuth(input.idToken);
  } catch {
    return { success: false, error: 'Autenticação necessária.' };
  }

  // Override client-supplied identity with server-verified data
  const verifiedCompanyId = authUser.companyId || input.companyId;
  const verifiedUserName = authUser.name || input.userName;
  const verifiedUserEmail = authUser.email || input.userEmail;

  if (!NOTION_API_KEY || !NOTION_DB_ID) {
    console.error('Notion credentials not configured');
    return { success: false, error: 'Integração com Notion não configurada.' };
  }

  try {
    // Resolve company name from verified companyId
    let companyName = verifiedCompanyId || 'N/A';
    if (verifiedCompanyId) {
      try {
        const companyDoc = await adminDb.collection('companies').doc(verifiedCompanyId).get();
        if (companyDoc.exists) {
          const companyData = companyDoc.data();
          companyName = companyData?.name || companyData?.companyName || verifiedCompanyId;
        }
      } catch (err) {
        console.error('Error fetching company name:', err);
      }
    }

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
    addRichTextIfExists('Usuário', `${verifiedUserName || 'Anônimo'} (${verifiedUserEmail || 'sem email'})`);
    addRichTextIfExists('Empresa', companyName);

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
      { object: 'block' as const, type: 'paragraph' as const, paragraph: { rich_text: [{ type: 'text' as const, text: { content: `📍 Página: ${input.pagina} | 👤 ${verifiedUserName || 'Anônimo'} (${verifiedUserEmail || ''}) | 🏢 ${companyName} | 📅 ${new Date().toLocaleDateString('pt-BR')}` } }] } },
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

// ─── Support Request to Notion ─────────────────────────────────

type SupportInput = {
  idToken: string;
  titulo: string;
  descricao: string;
  tipoConta: 'Colaborador' | 'Admin';
  pagina: string;
  userName?: string;
  userEmail?: string;
  companyId?: string;
  imageUrl?: string;
};

export async function sendSupportToNotion(input: SupportInput): Promise<{ success: boolean; error?: string }> {
  // Require authentication and use server-side user data
  let authUser;
  try {
    authUser = await requireAuth(input.idToken);
  } catch {
    return { success: false, error: 'Autenticação necessária.' };
  }

  // Override client-supplied identity with server-verified data
  const verifiedCompanyId = authUser.companyId || input.companyId;
  const verifiedUserName = authUser.name || input.userName;
  const verifiedUserEmail = authUser.email || input.userEmail;

  if (!NOTION_API_KEY || !NOTION_SUPPORT_DB_ID) {
    console.error('Notion support credentials not configured');
    return { success: false, error: 'Integração de suporte com Notion não configurada.' };
  }

  try {
    // Resolve company name from verified companyId
    let companyName = verifiedCompanyId || 'N/A';
    if (verifiedCompanyId) {
      try {
        const companyDoc = await adminDb.collection('companies').doc(verifiedCompanyId).get();
        if (companyDoc.exists) {
          const companyData = companyDoc.data();
          companyName = companyData?.name || companyData?.companyName || verifiedCompanyId;
        }
      } catch (err) {
        console.error('Error fetching company name:', err);
      }
    }

    // Discover database schema
    const dbResponse = await fetch(`https://api.notion.com/v1/databases/${NOTION_SUPPORT_DB_ID}`, {
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

    // Build properties — Title is always required
    const properties: Record<string, unknown> = {
      'Título': {
        title: [{ text: { content: input.titulo } }],
      },
    };

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

    addSelectIfExists('Tipo de Conta', input.tipoConta);
    addSelectIfExists('Página', input.pagina);
    addSelectIfExists('Status', 'Novo');
    addSelectIfExists('Prioridade', 'Média');
    addRichTextIfExists('Descrição', input.descricao);
    addRichTextIfExists('Usuário', `${verifiedUserName || 'Anônimo'} (${verifiedUserEmail || 'sem email'})`);
    addRichTextIfExists('Empresa', companyName);

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

    // Page content body
    const contentBlocks = [
      { object: 'block' as const, type: 'heading_3' as const, heading_3: { rich_text: [{ type: 'text' as const, text: { content: `Suporte: ${input.titulo}` } }] } },
      { object: 'block' as const, type: 'paragraph' as const, paragraph: { rich_text: [{ type: 'text' as const, text: { content: input.descricao } }] } },
      { object: 'block' as const, type: 'divider' as const, divider: {} },
      { object: 'block' as const, type: 'paragraph' as const, paragraph: { rich_text: [{ type: 'text' as const, text: { content: `📍 Página: ${input.pagina} | 👤 ${verifiedUserName || 'Anônimo'} (${verifiedUserEmail || ''}) | 🏢 ${companyName} | 🔑 ${input.tipoConta} | 📅 ${new Date().toLocaleDateString('pt-BR')}` } }] } },
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
        parent: { database_id: NOTION_SUPPORT_DB_ID },
        properties,
        children: contentBlocks,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Notion Support API error:', response.status, errorData);
      return { success: false, error: `Erro ao enviar para o Notion (${response.status}).` };
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending support request to Notion:', error);
    return { success: false, error: 'Erro de conexão com o Notion.' };
  }
}
