// Tests for escapeLittleText — fixes the bug where LinkedIn silently truncates
// posts containing unescaped reserved characters (parentheses, brackets, etc).
//
// Bug reproducer: the original post from Clara Ramos got cut off at
// "1. Made to Stick" because the LinkedIn parser saw "(Ideias que Colam)"
// as a malformed mention and stopped parsing there.

import { describe, it, expect } from 'vitest';
import { escapeLittleText } from '@/lib/linkedin';

describe('escapeLittleText', () => {
  it('escapa parênteses — bug original do post da Clara', () => {
    const input = '1. Made to Stick (Ideias que Colam)';
    expect(escapeLittleText(input)).toBe('1. Made to Stick \\(Ideias que Colam\\)');
  });

  it('mantém setas Unicode e acentos intactos', () => {
    const input = '→ pra entender por que algumas mensagens grudam';
    expect(escapeLittleText(input)).toBe(input);
  });

  it('escapa todos os 15 caracteres reservados', () => {
    const input = '( ) [ ] { } | @ # * ~ < > \\ _';
    const output = escapeLittleText(input);
    expect(output).toBe('\\( \\) \\[ \\] \\{ \\} \\| \\@ \\# \\* \\~ \\< \\> \\\\ \\_');
  });

  it('escapa backslash antes dos outros — ordem importa', () => {
    // Se o \ não for escapado primeiro, os \ inseridos pelos outros
    // caracteres seriam re-escapados, gerando \\\\ indevidamente.
    const input = 'a\\b';
    expect(escapeLittleText(input)).toBe('a\\\\b');
  });

  it('não altera texto sem caracteres reservados', () => {
    const input = 'Só 35% dos profissionais dominam os fundamentos básicos. E, sinceramente? Dá pra notar 🤡';
    expect(escapeLittleText(input)).toBe(input);
  });

  it('preserva emojis, acentos e quebras de linha', () => {
    const input = 'Linha 1 🤡\nLinha 2 com acentuação\n\nLinha 4 após linha vazia';
    expect(escapeLittleText(input)).toBe(input);
  });

  it('roundtrip: post completo da Clara volta idêntico após render do LinkedIn', () => {
    const input = `1. Made to Stick (Ideias que Colam)
→ pra entender por que algumas mensagens grudam

2. Design Is Storytelling (O Design como Storytelling)
→ pra entender como narrativa visual e experiência constroem percepção`;

    const escaped = escapeLittleText(input);

    // Simular a render do LinkedIn: remove \ antes de qualquer reservado
    const rendered = escaped.replace(/\\([()[\]{}|@#*~<>_\\])/g, '$1');
    expect(rendered).toBe(input);
  });

  it('lida com strings vazias', () => {
    expect(escapeLittleText('')).toBe('');
  });

  it('escapa hashtags e arrobas literais no texto', () => {
    const input = 'Vi o post do @fulano sobre #marketing';
    expect(escapeLittleText(input)).toBe('Vi o post do \\@fulano sobre \\#marketing');
  });

  it('escapa asteriscos usados como bullet points', () => {
    const input = '* Item 1\n* Item 2';
    expect(escapeLittleText(input)).toBe('\\* Item 1\n\\* Item 2');
  });
});
