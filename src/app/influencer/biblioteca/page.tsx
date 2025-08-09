// src/app/influencer/biblioteca/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

// This would come from the user's session
const companyId = "company-123";

type Asset = {
    id: string;
    name: string;
    type: string;
    category: 'Posts' | 'Materiais Ricos' | 'Assets de Marca';
    uploadDate: any; // Firestore timestamp
    fileUrl: string; 
};

const getAssetIcon = (type: string, fileUrl?: string) => {
    if (type.startsWith('image/')) {
        return (
             <Image
                src={fileUrl || 'https://placehold.co/600x400.png'}
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
                 {getAssetIcon(asset.type, asset.fileUrl)}
            </div>
        </CardHeader>
        <CardContent className="p-4 space-y-1">
            <CardTitle className="text-base font-semibold">{asset.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{asset.type}</p>
            <p className="text-xs text-muted-foreground">Adicionado em {asset.uploadDate?.toDate().toLocaleDateString() || 'N/A'}</p>
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
    const { toast } = useToast();

    useEffect(() => {
        const fetchAssets = async () => {
            setIsLoading(true);
            try {
                const assetsCollection = collection(db, "companies", companyId, "assets");
                const assetsSnapshot = await getDocs(assetsCollection);
                const assetsList = assetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
                setAssets(assetsList);
            } catch (error) {
                console.error("Failed to fetch assets:", error);
                 toast({ variant: 'destructive', title: 'Erro ao buscar ativos.' });
            } finally {
                setIsLoading(false);
            }
        }
        fetchAssets();
    }, [toast]);


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
