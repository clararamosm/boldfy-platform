// src/app/admin/biblioteca/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
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

const companyId = "company-123"; // In a real app, this would come from the user's session

// In a real app, this type would likely be defined in a shared types file.
type Asset = {
    id: string;
    name: string;
    type: string;
    category: 'Posts' | 'Materiais Ricos' | 'Assets de Marca';
    uploadDate: any; // Firestore timestamp
    fileUrl: string; 
    filePath: string; // To find the file in Storage for deletion
};

const getAssetIcon = (type: string) => {
    if (type.startsWith('image/')) {
        return <ImageIcon className="h-5 w-5 text-muted-foreground" />;
    }
    return <FileText className="h-5 w-5 text-muted-foreground" />;
};


// AssetForm Component for Create/Edit
const AssetForm = ({ asset, isSubmitting, formRef, fileRef }: { asset?: Asset, isSubmitting: boolean, formRef: React.RefObject<HTMLFormElement>, fileRef: React.RefObject<HTMLInputElement> }) => (
    <form id="asset-form" ref={formRef}>
        <div className="space-y-4">
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
                <Input id="asset-file" name="file" type="file" required={!asset} disabled={isSubmitting} ref={fileRef} />
                {asset && <p className="text-xs text-muted-foreground">Deixe em branco para manter o arquivo atual.</p>}
            </div>
        </div>
    </form>
);


export default function AdminBibliotecaPage() {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchAssets = async () => {
        setIsLoading(true);
        try {
            const assetsCollection = collection(db, "companies", companyId, "assets");
            const assetsSnapshot = await getDocs(assetsCollection);
            const assetsList = assetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
            setAssets(assetsList);
        } catch (error) {
            console.error("Error fetching assets: ", error);
            toast({ variant: "destructive", title: "Erro ao buscar ativos."});
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchAssets();
    }, []);

    const handleAction = async (assetId?: string) => {
        setIsSubmitting(true);
        const formData = new FormData(formRef.current!);
        const file = fileInputRef.current?.files?.[0];

        try {
            if (!assetId && !file) {
                throw new Error("Um arquivo é obrigatório para um novo ativo.");
            }

            let fileUrl = '';
            let filePath = '';
            
            if (file) {
                // If editing, delete the old file first
                if (assetId) {
                    const oldAsset = assets.find(a => a.id === assetId);
                    if (oldAsset?.filePath) {
                        const oldFileRef = ref(storage, oldAsset.filePath);
                        await deleteObject(oldFileRef).catch(err => console.warn("Old file not found, continuing...", err));
                    }
                }
                
                filePath = `companies/${companyId}/assets/${Date.now()}-${file.name}`;
                const storageRef = ref(storage, filePath);
                const uploadResult = await uploadBytes(storageRef, file);
                fileUrl = await getDownloadURL(uploadResult.ref);
            }

            const assetData = {
                name: formData.get('name') as string,
                category: formData.get('category') as string,
                ...(file && { 
                    fileUrl, 
                    filePath, 
                    type: file.type,
                    uploadDate: serverTimestamp() 
                }),
            };

            if (assetId) {
                // Update
                const assetDoc = doc(db, "companies", companyId, "assets", assetId);
                await updateDoc(assetDoc, assetData);
            } else {
                // Create
                await addDoc(collection(db, "companies", companyId, "assets"), assetData);
            }

            toast({
                title: "Sucesso!",
                description: `Ativo ${assetId ? 'atualizado' : 'criado'} com sucesso.`,
            });
            fetchAssets(); // Refetch assets list
        } catch (error) {
            console.error("Error submitting asset:", error);
            toast({ variant: "destructive", title: "Erro ao salvar ativo.", description: (error as Error).message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDelete = async (asset: Asset) => {
        if (!confirm(`Tem certeza que deseja excluir o ativo "${asset.name}"?`)) return;
        
        try {
            // Delete file from Storage
            const fileRef = ref(storage, asset.filePath);
            await deleteObject(fileRef);

            // Delete doc from Firestore
            const assetDoc = doc(db, "companies", companyId, "assets", asset.id);
            await deleteDoc(assetDoc);
            
            toast({
                title: `Ativo excluído.`,
                description: "O ativo foi removido com sucesso.",
            });
            fetchAssets(); // Refetch
        } catch(error) {
            console.error("Error deleting asset:", error);
             toast({ variant: "destructive", title: "Erro ao excluir ativo." });
        }
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
            formId="asset-form"
        >
            <AssetForm asset={asset} isSubmitting={isSubmitting} formRef={formRef} fileRef={fileInputRef} />
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
              formId="asset-form"
            >
              <AssetForm isSubmitting={isSubmitting} formRef={formRef} fileRef={fileInputRef} />
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
                        <TableCell>{asset.uploadDate?.toDate().toLocaleDateString() || 'N/A'}</TableCell>
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
                                <DropdownMenuItem className="text-destructive" onSelect={() => handleDelete(asset)}>
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
