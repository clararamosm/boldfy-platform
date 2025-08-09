// src/app/influencer/biblioteca/page.tsx
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ImageIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";

type Asset = {
    title: string;
    type: string;
    category: 'Posts' | 'Materiais Ricos' | 'Assets de Marca';
    date: string;
    image?: string;
    dataAiHint?: string;
    icon?: React.ReactNode;
};

const assets: Asset[] = [
    { title: "Banner LinkedIn - Lançamento", type: "Imagem (PNG)", category: "Posts", date: "15/07/2024", image: "https://placehold.co/600x400.png", dataAiHint: "corporate banner" },
    { title: "Guia de Tom de Voz", type: "Documento (PDF)", category: "Assets de Marca", date: "20/06/2024", icon: <FileText className="h-12 w-12 text-muted-foreground" /> },
    { title: "Ebook sobre IA", type: "Documento (PDF)", category: "Materiais Ricos", date: "18/07/2024", icon: <FileText className="h-12 w-12 text-muted-foreground" /> },
];

const AssetCard = ({ icon, title, type, date, image, dataAiHint }) => (
    <Card>
        <CardHeader className="p-0">
            <div className="aspect-video bg-muted flex items-center justify-center rounded-t-lg overflow-hidden">
                {image ? (
                     <Image
                        src={image}
                        alt={title}
                        width={300}
                        height={168}
                        className="w-full h-full object-cover"
                        data-ai-hint={dataAiHint}
                     />
                ) : (
                    icon
                )}
            </div>
        </CardHeader>
        <CardContent className="p-4 space-y-1">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{type}</p>
            <p className="text-xs text-muted-foreground">Adicionado em {date}</p>
        </CardContent>
        <CardFooter>
            <Button className="w-full" variant="secondary"><Download className="mr-2 h-4 w-4" />Baixar</Button>
        </CardFooter>
    </Card>
);

export default function InfluencerBibliotecaPage() {
  const renderAssets = (category?: Asset['category']) => {
    const filteredAssets = category ? assets.filter(asset => asset.category === category) : assets;
    if (filteredAssets.length === 0) {
      return <p className="text-muted-foreground">Nenhum ativo encontrado nesta categoria.</p>;
    }
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredAssets.map(asset => <AssetCard key={asset.title} {...asset} />)}
      </div>
    );
  };

  return (
    <>
      <Header title="Biblioteca" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
          <Tabs defaultValue="todos">
              <TabsList className="mb-4">
                  <TabsTrigger value="todos">Todos</TabsTrigger>
                  <TabsTrigger value="posts">Posts</TabsTrigger>
                  <TabsTrigger value="materiais-ricos">Materiais Ricos</TabsTrigger>
                  <TabsTrigger value="assets-marca">Assets de Marca</TabsTrigger>
              </TabsList>
               <TabsContent value="todos">
                  {renderAssets()}
              </TabsContent>
               <TabsContent value="posts">
                  {renderAssets('Posts')}
               </TabsContent>
               <TabsContent value="materiais-ricos">
                  {renderAssets('Materiais Ricos')}
               </TabsContent>
                <TabsContent value="assets-marca">
                  {renderAssets('Assets de Marca')}
               </TabsContent>
          </Tabs>
      </main>
    </>
  );
}