// src/app/post/[companyId]/[tlId]/[postId]/page.tsx
import { PostEditorShell } from '@/components/post-editor/post-editor-shell';
import { SlugResolver } from '@/components/post-editor/slug-resolver';

type Props = {
  params: Promise<{
    companyId: string;
    tlId: string;
    postId: string;
  }>;
};

export default async function PostPage({ params }: Props) {
  const { companyId, tlId, postId } = await params;

  // companyId and tlId may be slugs or raw Firestore IDs
  // SlugResolver handles resolution on the client side
  return <SlugResolver companySlug={companyId} tlSlug={tlId} postId={postId} />;
}
