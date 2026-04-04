// src/app/colaborador/biblioteca/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, doc, getDoc, where, orderBy, Timestamp, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Star, ClipboardCopy, Check, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { toggleStarContent } from '@/app/actions';

type Asset = {
    id: string;
    name: string;
    type: string;
    category: 'Posts' | 'Materiais Ricos' | 'Assets de Marca';
    uploadDate: any;
    fileUrl: string;
};

type GeneratedContent = {
    id: string;
    input: string;
    output: string;
    format: string;
    length: string;
    starred: boolean;
    createdAt: any;
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

const GeneratedContentCard = ({
    item,
    userId,
    onStarToggle,
    onDelete,
}: {
    item: GeneratedContent;
    userId: string;
    onStarToggle: (id: string, starred: boolean) => void;
    onDelete: (id: string) => void;
}) => {
    const [isCopied, setIsCopied] = useState(false);
    const [isToggling, setIsToggling] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(item.output);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleStar = async () => {
        setIsToggling(true);
        await onStarToggle(item.id, !item.starred);
        setIsToggling(false);
    };

    const createdDate = item.createdAt?.toDate ? item.createdAt.toDate() : new Date();
    const daysAgo = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

    return (
        <Card className="flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.input}</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={handleStar}
                        disabled={isToggling}
                    >
                        <Star className={`h-4 w-4 ${item.starred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    {createdDate.toLocaleDateString('pt-BR')} · {daysAgo === 0 ? 'Hoje' : `${daysAgo}d atrás`}
                    {!item.starred && daysAgo > 20 && <span className="text-orange-400 ml-1">· Expira em {30 - daysAgo}d</span>}
                </p>
            </CardHeader>
            <CardContent className="flex-1 pb-2">
                <div className="bg-muted rounded-md p-3 max-h-48 overflow-y-auto">
                    <p className="text-sm whitespace-pre-line">{item.output}</p>
                </div>
            </CardContent>
            <CardFooter className="gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={handleCopy}>
                    {isCopied ? <Check className="mr-1 h-3 w-3" /> : <ClipboardCopy className="mr-1 h-3 w-3" />}
                    {isCopied ? 'Copiado' : 'Copiar'}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </CardFooter>
        </Card>
    );
};

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
);

export default function ColaboradorBibliotecaPage() {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingContent, setIsLoadingContent] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [companyId, setCompanyId] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchAssets = useCallback(async (cId: string) => {
        setIsLoading(true);
        try {
            const assetsCollection = collection(db, "companies", cId, "assets");
            const assetsSnapshot = await getDocs(assetsCollection);
            const assetsList = assetsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Asset));
            setAssets(assetsList);
        } catch (error) {
            console.error("Failed to fetch assets:", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar ativos.' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    const fetchGeneratedContent = useCallback(async (uid: string) => {
        setIsLoadingContent(true);
        try {
            // Fetch all content, filter client-side for 30-day window (starred = permanent)
            const contentRef = collection(db, 'users', uid, 'generatedContent');
            const q = query(contentRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const items: GeneratedContent[] = [];
            snapshot.docs.forEach(d => {
                const data = d.data();
                const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
                // Keep starred items forever, others only for 30 days
                if (data.starred || createdAt >= thirtyDaysAgo) {
                    items.push({ id: d.id, ...data } as GeneratedContent);
                }
            });
            setGeneratedContent(items);
        } catch (error) {
            console.error("Failed to fetch generated content:", error);
        } finally {
            setIsLoadingContent(false);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
            if (user) {
                setUserId(user.uid);
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const cId = userDocSnap.data().companyId;
                    setCompanyId(cId);
                    fetchAssets(cId);
                    fetchGeneratedContent(user.uid);
                } else {
                    toast({ variant: 'destructive', title: "Erro de usuário" });
                    setIsLoading(false);
                    setIsLoadingContent(false);
                }
            } else {
                setIsLoading(false);
                setIsLoadingContent(false);
            }
        });
        return () => unsubscribe();
    }, [fetchAssets, fetchGeneratedContent, toast]);

    const handleStarToggle = async (contentId: string, starred: boolean) => {
        if (!userId) return;
        const result = await toggleStarContent(userId, contentId, starred);
        if (result.success) {
            setGeneratedContent(prev =>
                prev.map(item => item.id === contentId ? { ...item, starred } : item)
            );
        }
    };

    const handleDeleteContent = async (contentId: string) => {
        if (!userId) return;
        try {
            await deleteDoc(doc(db, 'users', userId, 'generatedContent', contentId));
            setGeneratedContent(prev => prev.filter(item => item.id !== contentId));
            toast({ title: "Conteúdo removido." });
        } catch {
            toast({ variant: 'destructive', title: "Erro ao remover conteúdo." });
        }
    };

    const renderAssets = (category?: Asset['category']) => {
        if (isLoading) return <AssetGridSkeleton />;
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

    const renderGeneratedContent = (filter: 'all' | 'starred') => {
        if (isLoadingContent) return <AssetGridSkeleton />;
        const filtered = filter === 'starred'
            ? generatedContent.filter(item => item.starred)
            : generatedContent;
        if (filtered.length === 0) {
            return (
                <p className="text-muted-foreground text-center py-8">
                    {filter === 'starred'
                        ? 'Nenhum conteúdo favoritado. Use a estrela para salvar seus melhores conteúdos.'
                        : 'Nenhum conteúdo gerado ainda. Use o Assistente IA para criar captions.'}
                </p>
            );
        }
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map(item => (
                    <GeneratedContentCard
                        key={item.id}
                        item={item}
                        userId={userId!}
                        onStarToggle={handleStarToggle}
                        onDelete={handleDeleteContent}
                    />
                ))}
            </div>
        );
    };

    const starredCount = generatedContent.filter(i => i.starred).length;

    return (
        <>
            <Header title="Biblioteca" />
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <Tabs defaultValue="meus-conteudos">
                    <TabsList className="mb-4">
                        <TabsTrigger value="meus-conteudos">
                            Meus Conteúdos {generatedContent.length > 0 && `(${generatedContent.length})`}
                        </TabsTrigger>
                        <TabsTrigger value="favoritos">
                            Favoritos {starredCount > 0 && `(${starredCount})`}
                        </TabsTrigger>
                        <TabsTrigger value="todos">Todos os Assets</TabsTrigger>
                        <TabsTrigger value="posts">Posts</TabsTrigger>
                        <TabsTrigger value="materiais-ricos">Materiais Ricos</TabsTrigger>
                        <TabsTrigger value="assets-marca">Assets de Marca</TabsTrigger>
                    </TabsList>
                    <TabsContent value="meus-conteudos">
                        <div className="mb-4">
                            <p className="text-sm text-muted-foreground">
                                Conteúdos gerados pelo Assistente IA. Favorite com a estrela para manter permanentemente — os demais expiram em 30 dias.
                            </p>
                        </div>
                        {renderGeneratedContent('all')}
                    </TabsContent>
                    <TabsContent value="favoritos">
                        {renderGeneratedContent('starred')}
                    </TabsContent>
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
