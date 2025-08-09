// src/app/admin/biblioteca/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, FileText, ImageIcon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';

// In a real app, this type would likely be defined in a shared types file.
type Asset = {
    id: string;
    name: string;
    type: string;
    category: 'Posts' | 'Materiais Ricos' | 'Assets de Marca';
    uploadDate: string;
    fileUrl: string; // URL from Firebase Storage
};

const getAssetIcon = (type: string) => {
    if (type.startsWith('image/')) {
        return <ImageIcon className="h-5 w-5 text-muted-foreground" />;
    }
    return <FileText className="h-5 w-5 text-muted-foreground" />;
};


// AssetForm Component for Create/Edit
const AssetForm = ({ asset, isSubmitting }: { asset?: Asset, isSubmitting: boolean }) => (
    <>
        <div className="space-y-2">
            <Label htmlFor="asset-name">Nome do Ativo</Label>
            <Input id="asset-name" name="name" placeholder="Ex: Banner para LinkedIn" defaultValue={asset?.name} required disabled={isSubmitting} />
        </div>
        <div className="space-y-2">
            <Label htmlFor="asset-category">Categoria</Label>
            <Select name="category" defaultValue={asset?.category} required disabled={isSubmitting}>
                <SelectTrigger id="asset-category">
                    <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Posts">Posts</SelectItem>
                    <SelectItem value="Materiais Ricos">Materiais Ricos</SelectItem>
                    <SelectItem value="Assets de Marca">Assets de Marca</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <div className="space-y-2">
            <Label htmlFor="asset-file">Arquivo</Label>
            <Input id="asset-file" name="file" type="file" required={!asset} disabled={isSubmitting} />
            {asset && <p className="text-xs text-muted-foreground">Deixe em branco para manter o arquivo atual.</p>}
        </div>
    </>
);


export default function AdminBibliotecaPage() {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    // Fetch assets from Firestore
    useEffect(() => {
        const fetchAssets = async () => {
            setIsLoading(true);
            try {
                // MOCK DATA - In a real app, fetch from Firestore collection
                // e.g., /companies/{companyId}/assets
                 const mockAssets: Asset[] = [
                    { id: "1", name: "Banner LinkedIn - Lançamento", type: "image/png", category: "Posts", uploadDate: "2024-07-15", fileUrl: "#" },
                    { id: "2", name: "Guia de Tom de Voz", type: "application/pdf", category: "Assets de Marca", uploadDate: "2024-06-20", fileUrl: "#" },
                    { id: "3", name: "Ebook sobre IA", type: "application/pdf", category: "Materiais Ricos", uploadDate: "2024-07-18", fileUrl: "#" },
                ];
                await new Promise(resolve => setTimeout(resolve, 1000));
                setAssets(mockAssets);
            } catch (error) {
                console.error("Error fetching assets: ", error);
                toast({ variant: "destructive", title: "Erro ao buscar ativos."});
            } finally {
                setIsLoading(false);
            }
        };
        fetchAssets();
    }, [toast]);

    const handleAction = async (assetId?: string) => {
        setIsSubmitting(true);
        // TODO: Implement file upload to Storage and data saving to Firestore
        console.log("Submitting form...", assetId ? `Editing ${assetId}`: 'Creating new');
        try {
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate async operation
            toast({
                title: "Sucesso!",
                description: `Ativo ${assetId ? 'atualizado' : 'criado'} com sucesso.`,
            });
            // Here you would refetch the assets list
        } catch (error) {
            console.error("Error submitting asset:", error);
            toast({ variant: "destructive", title: "Erro ao salvar ativo."});
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDelete = async (assetId: string) => {
        // TODO: Implement file deletion from Storage and data from Firestore
        toast({
            title: `Ativo ${assetId} excluído.`,
            description: "A exclusão foi simulada com sucesso.",
        });
    }

    const uploadButton = (
        <Button size="sm" disabled={isSubmitting}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Upload
        </Button>
    );

    const EditAssetButton = ({ asset }: { asset: Asset }) => (
        <ActionDialog
            title="Editar Ativo"
            description="Atualize as informações ou troque o arquivo do ativo."
            trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Editar</DropdownMenuItem>}
            actionText={isSubmitting ? "Salvando..." : "Salvar Alterações"}
            onAction={() => handleAction(asset.id)}
        >
            <AssetForm asset={asset} isSubmitting={isSubmitting} />
        </ActionDialog>
    );

  return (
    <>
      <Header title="Biblioteca" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-headline">Gerenciar Ativos</CardTitle>
              <CardDescription>Faça upload e gerencie os ativos da sua marca.</CardDescription>
            </div>
             <ActionDialog
              title="Novo Upload"
              description="Faça o upload de um novo ativo para a biblioteca da sua marca."
              trigger={uploadButton}
              actionText={isSubmitting ? "Enviando..." : "Fazer Upload"}
              onAction={() => handleAction()}
            >
              <AssetForm isSubmitting={isSubmitting} />
            </ActionDialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Ativo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                   <TableHead>Data de Upload</TableHead>
                  <TableHead><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                     <TableRow>
                        <TableCell colSpan={5} className="text-center">
                            <div className="flex justify-center items-center p-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                <span className="ml-2">Carregando ativos...</span>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : assets.length === 0 ? (
                     <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                           Nenhum ativo encontrado.
                        </TableCell>
                    </TableRow>
                ) : assets.map((asset) => (
                    <TableRow key={asset.id}>
                        <TableCell className="font-medium flex items-center gap-2">
                            {getAssetIcon(asset.type)}
                            {asset.name}
                        </TableCell>
                        <TableCell>{asset.type.split('/')[1]?.toUpperCase()}</TableCell>
                        <TableCell>
                            <Badge variant="outline">{asset.category}</Badge>
                        </TableCell>
                        <TableCell>{asset.uploadDate}</TableCell>
                        <TableCell>
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                    <a href={asset.fileUrl} target="_blank" rel="noopener noreferrer">Baixar</a>
                                </DropdownMenuItem>
                                <EditAssetButton asset={asset} />
                                <DropdownMenuItem className="text-destructive" onSelect={() => handleDelete(asset.id)}>
                                    Excluir
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
