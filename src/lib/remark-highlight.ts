// src/lib/remark-highlight.ts
// Custom remark plugin: converts ==text== into <mark>text</mark>
import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Text, Parent } from 'mdast';

const remarkHighlight: Plugin = () => {
  return (tree) => {
    visit(tree, 'text', (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (!parent || index === undefined) return;
      const regex = /==(.+?)==/g;
      const value = node.value;
      if (!regex.test(value)) return;

      regex.lastIndex = 0;
      const newNodes: any[] = [];
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(value)) !== null) {
        if (match.index > lastIndex) {
          newNodes.push({ type: 'text', value: value.slice(lastIndex, match.index) });
        }
        newNodes.push({
          type: 'html',
          value: `<mark>${match[1]}</mark>`,
        });
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < value.length) {
        newNodes.push({ type: 'text', value: value.slice(lastIndex) });
      }

      parent.children.splice(index, 1, ...newNodes);
    });
  };
};

export default remarkHighlight;
