// src/app/post/[companyId]/[tlId]/[postId]/page.tsx
import { PostEditorShell } from '@/components/post-editor/post-editor-shell';

type Props = {
  params: Promise<{
    companyId: string;
    tlId: string;
    postId: string;
  }>;
};

export default async function PostPage({ params }: Props) {
  const { companyId, tlId, postId } = await params;

  return <PostEditorShell companyId={companyId} tlId={tlId} postId={postId} />;
}
