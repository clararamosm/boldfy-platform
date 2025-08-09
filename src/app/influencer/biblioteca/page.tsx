import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ImageIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";

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
  return (
    <>
      <Header title="Biblioteca" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
          <Tabs defaultValue="todos">
              <TabsList className="mb-4">
                  <TabsTrigger value="todos">Todos</TabsTrigger>
                  <TabsTrigger value="banners">Banners</TabsTrigger>
                  <TabsTrigger value="documentos">Documentos</TabsTrigger>
                  <TabsTrigger value="imagens">Imagens</TabsTrigger>
              </TabsList>
               <TabsContent value="todos">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      <AssetCard
                          title="Banner LinkedIn - Lançamento"
                          type="Imagem (PNG)"
                          date="15/07/2024"
                          image="https://placehold.co/600x400.png"
                          dataAiHint="corporate banner"
                      />
                       <AssetCard
                          icon={<FileText className="h-12 w-12 text-muted-foreground" />}
                          title="Guia de Tom de Voz"
                          type="Documento (PDF)"
                          date="20/06/2024"
                      />
                  </div>
              </TabsContent>
               <TabsContent value="banners">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                         <AssetCard
                          title="Banner LinkedIn - Lançamento"
                          type="Imagem (PNG)"
                          date="15/07/2024"
                          image="https://placehold.co/600x400.png"
                          dataAiHint="corporate banner"
                      />
                    </div>
               </TabsContent>
               <TabsContent value="documentos">
                   <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                         <AssetCard
                          icon={<FileText className="h-12 w-12 text-muted-foreground" />}
                          title="Guia de Tom de Voz"
                          type="Documento (PDF)"
                          date="20/06/2024"
                      />
                   </div>
               </TabsContent>
                <TabsContent value="imagens">
                     <p className="text-muted-foreground">Nenhum ativo de imagem encontrado.</p>
               </TabsContent>
          </Tabs>
      </main>
    </>
  );
}
