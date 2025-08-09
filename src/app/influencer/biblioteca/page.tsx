// src/app/influencer/biblioteca/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ImageIcon, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import { Skeleton } from '@/components/ui/skeleton';


type Asset = {
    id: string;
    title: string;
    type: string;
    category: 'Posts' | 'Materiais Ricos' | 'Assets de Marca';
    date: string;
    imageUrl?: string;
    dataAiHint?: string;
    fileUrl: string; // URL from Firebase Storage
};

const getAssetIcon = (type: string, imageUrl?: string) => {
    if (type.startsWith('image/')) {
        return (
             <Image
                src={imageUrl || 'https://placehold.co/600x400.png'}
                alt=""
                width={300}
                height={168}
                className="w-full h-full object-cover"
             />
        )
    }
    return <FileText className="h-12 w-12 text-muted-foreground" />;
};


const AssetCard = ({ asset }: { asset: Asset }) => (
    <Card>
        <CardHeader className="p-0">
            <div className="aspect-video bg-muted flex items-center justify-center rounded-t-lg overflow-hidden">
                 {getAssetIcon(asset.type, asset.imageUrl)}
            </div>
        </CardHeader>
        <CardContent className="p-4 space-y-1">
            <CardTitle className="text-base font-semibold">{asset.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{asset.type}</p>
            <p className="text-xs text-muted-foreground">Adicionado em {asset.date}</p>
        </CardContent>
        <CardFooter>
            <Button className="w-full" variant="secondary" asChild>
                <a href={asset.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Baixar
                </a>
            </Button>
        </CardFooter>
    </Card>
);

const AssetGridSkeleton = () => (
     <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
            <Card key={i}>
                 <CardHeader className="p-0">
                    <Skeleton className="aspect-video rounded-t-lg" />
                 </CardHeader>
                 <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                 </CardContent>
                 <CardFooter>
                    <Skeleton className="h-10 w-full" />
                 </CardFooter>
            </Card>
        ))}
    </div>
)


export default function InfluencerBibliotecaPage() {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAssets = async () => {
            setIsLoading(true);
            try {
                // MOCK DATA - In a real app, fetch from Firestore
                const mockAssets: Asset[] = [
                    { id: "1", title: "Banner LinkedIn - Lançamento", type: "image/png", category: "Posts", date: "15/07/2024", imageUrl: "https://placehold.co/600x400.png", dataAiHint: "corporate banner", fileUrl: "#" },
                    { id: "2", title: "Guia de Tom de Voz", type: "application/pdf", category: "Assets de Marca", date: "20/06/2024", fileUrl: "#" },
                    { id: "3", title: "Ebook sobre IA", type: "application/pdf", category: "Materiais Ricos", date: "18/07/2024", fileUrl: "#" },
                ];
                await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
                setAssets(mockAssets);
            } catch (error) {
                console.error("Failed to fetch assets:", error);
                // In a real app, show a toast notification
            } finally {
                setIsLoading(false);
            }
        }
        fetchAssets();
    }, []);


  const renderAssets = (category?: Asset['category']) => {
    if (isLoading) {
        return <AssetGridSkeleton />;
    }

    const filteredAssets = category ? assets.filter(asset => asset.category === category) : assets;
    if (filteredAssets.length === 0) {
      return <p className="text-muted-foreground text-center py-8">Nenhum ativo encontrado nesta categoria.</p>;
    }
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredAssets.map(asset => <AssetCard key={asset.id} asset={asset} />)}
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
