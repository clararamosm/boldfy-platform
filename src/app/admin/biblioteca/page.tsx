// src/app/admin/biblioteca/page.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
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
import { useT } from '@/lib/i18n/context';

type Asset = {
    id: string;
    name: string;
    type: string;
    category: 'Posts' | 'Materiais Ricos' | 'Assets de Marca';
    uploadDate: { toDate?: () => Date } | string | null;
    fileUrl: string; 
    filePath: string;
};

const getAssetIcon = (type: string) => {
    if (type.startsWith('image/')) {
        return <ImageIcon className="h-5 w-5 text-muted-foreground" />;
    }
    return <FileText className="h-5 w-5 text-muted-foreground" />;
};

const AssetForm = ({ asset, isSubmitting, formRef, fileRef }: { asset?: Asset, isSubmitting: boolean, formRef: React.RefObject<HTMLFormElement>, fileRef: React.RefObject<HTMLInputElement> }) => {
    const t = useT();
    return (
    <form id="asset-form" ref={formRef}>
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="asset-name">{t.adminLibrary.assetName}</Label>
                <Input id="asset-name" name="name" placeholder={t.adminLibrary.assetNamePlaceholder} defaultValue={asset?.name} required disabled={isSubmitting} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="asset-category">{t.adminLibrary.category}</Label>
                <Select name="category" defaultValue={asset?.category} required disabled={isSubmitting}>
                    <SelectTrigger id="asset-category">
                        <SelectValue placeholder={t.adminLibrary.categoryPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Posts">{t.adminLibrary.categoryPosts}</SelectItem>
                        <SelectItem value="Materiais Ricos">{t.adminLibrary.categoryRichMaterials}</SelectItem>
                        <SelectItem value="Assets de Marca">{t.adminLibrary.categoryBrandAssets}</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="asset-file">{t.adminLibrary.file}</Label>
                <Input id="asset-file" name="file" type="file" required={!asset} disabled={isSubmitting} ref={fileRef} />
                {asset && <p className="text-xs text-muted-foreground">{t.adminLibrary.fileKeepCurrent}</p>}
            </div>
        </div>
    </form>
    );
};


export default function AdminBibliotecaPage() {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user: authUser } = useAuth();
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState<string | null>(null);
    const { toast } = useToast();
    const t = useT();
    const formRef = useRef<HTMLFormElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchAssets = useCallback(async (currentCompanyId: string) => {
        setIsLoading(true);
        try {
            const assetsCollection = collection(db, "companies", currentCompanyId, "assets");
            const assetsSnapshot = await getDocs(assetsCollection);
            const assetsList = assetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
            setAssets(assetsList);
        } catch (error) {
            console.error("Error fetching assets: ", error);
            toast({ variant: "destructive", title: t.adminLibrary.toastFetchError});
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (!authUser?.uid) return;
        const init = async () => {
            const userDocRef = doc(db, "users", authUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userCompanyId = userDocSnap.data().companyId;
                setCompanyId(userCompanyId);
                fetchAssets(userCompanyId);
            } else {
                toast({ variant: "destructive", title: t.adminLibrary.toastUserNotFound});
                setIsLoading(false);
            }
        };
        init();
    }, [authUser?.uid, fetchAssets, toast]);
    

    const handleAction = async (assetId?: string) => {
        if (!companyId) return;

        setIsSubmitting(true);
        const formData = new FormData(formRef.current!);
        const file = fileInputRef.current?.files?.[0];

        try {
            if (!assetId && !file) {
                throw new Error(t.adminLibrary.fileRequired);
            }

            let fileUrl = '';
            let filePath = '';
            
            if (file) {
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

            const assetData: Partial<Asset> & {category: string, name: string} = {
                name: formData.get('name') as string,
                category: formData.get('category') as 'Posts' | 'Materiais Ricos' | 'Assets de Marca',
                ...(file && { 
                    fileUrl, 
                    filePath, 
                    type: file.type,
                    uploadDate: serverTimestamp() as unknown as Asset['uploadDate']
                }),
            };

            if (assetId) {
                const assetDoc = doc(db, "companies", companyId, "assets", assetId);
                await updateDoc(assetDoc, assetData);
            } else {
                await addDoc(collection(db, "companies", companyId, "assets"), assetData);
            }

            toast({
                title: t.common.success,
                description: assetId ? t.adminLibrary.toastUpdated : t.adminLibrary.toastCreated,
            });

            // Close dialog and clean up form
            if (assetId) {
                setEditDialogOpen(null);
            } else {
                setUploadDialogOpen(false);
            }
            if (formRef.current) formRef.current.reset();
            if (fileInputRef.current) fileInputRef.current.value = '';

            fetchAssets(companyId);
        } catch (error) {
            console.error("Error submitting asset:", error);
            toast({ variant: "destructive", title: t.adminLibrary.toastSaveError, description: (error as Error).message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDelete = async (asset: Asset) => {
        if (!companyId || !confirm(t.adminLibrary.deleteConfirm.replace('{name}', asset.name))) return;
        
        try {
            if (asset.filePath) {
                const fileRef = ref(storage, asset.filePath);
                await deleteObject(fileRef).catch(err => console.warn("File not found in storage, continuing...", err));
            }

            const assetDoc = doc(db, "companies", companyId, "assets", asset.id);
            await deleteDoc(assetDoc);
            
            toast({
                title: t.adminLibrary.toastDeleted,
                description: t.adminLibrary.toastDeletedDescription,
            });
            fetchAssets(companyId);
        } catch(error) {
            console.error("Error deleting asset:", error);
             toast({ variant: "destructive", title: t.adminLibrary.toastDeleteError });
        }
    }

    const uploadButton = (
        <Button size="sm" disabled={isSubmitting || !companyId}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t.adminLibrary.newUpload}
        </Button>
    );

    const EditAssetButton = ({ asset }: { asset: Asset }) => (
        <ActionDialog
            title={t.adminLibrary.editTitle}
            description={t.adminLibrary.editDescription}
            trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>{t.common.edit}</DropdownMenuItem>}
            actionText={isSubmitting ? t.common.saving : t.common.saveChanges}
            onAction={() => handleAction(asset.id)}
            formId="asset-form"
            open={editDialogOpen === asset.id}
            onOpenChange={(open) => setEditDialogOpen(open ? asset.id : null)}
        >
            <AssetForm asset={asset} isSubmitting={isSubmitting} formRef={formRef} fileRef={fileInputRef} />
        </ActionDialog>
    );

  return (
    <>
      <Header title={t.adminLibrary.title} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-headline">{t.adminLibrary.manageAssets}</CardTitle>
              <CardDescription>{t.adminLibrary.manageAssetsDescription}</CardDescription>
            </div>
             <ActionDialog
              title={t.adminLibrary.uploadTitle}
              description={t.adminLibrary.uploadDescription}
              trigger={uploadButton}
              actionText={isSubmitting ? t.adminLibrary.uploading : t.adminLibrary.upload}
              onAction={() => handleAction()}
              formId="asset-form"
              open={uploadDialogOpen}
              onOpenChange={setUploadDialogOpen}
            >
              <AssetForm isSubmitting={isSubmitting} formRef={formRef} fileRef={fileInputRef} />
            </ActionDialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.adminLibrary.tableAssetName}</TableHead>
                  <TableHead>{t.adminLibrary.tableType}</TableHead>
                  <TableHead>{t.adminLibrary.tableCategory}</TableHead>
                   <TableHead>{t.adminLibrary.tableUploadDate}</TableHead>
                  <TableHead><span className="sr-only">{t.common.actions}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                     <TableRow>
                        <TableCell colSpan={5} className="text-center">
                            <div className="flex justify-center items-center p-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                <span className="ml-2">{t.adminLibrary.loading}</span>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : assets.length === 0 ? (
                     <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                           {t.adminLibrary.empty}
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
                        <TableCell>{asset.uploadDate && typeof asset.uploadDate === 'object' && asset.uploadDate !== null && 'toDate' in asset.uploadDate && typeof asset.uploadDate.toDate === 'function' ? asset.uploadDate.toDate().toLocaleDateString() : asset.uploadDate ? new Date(asset.uploadDate as string).toLocaleDateString() : 'N/A'}</TableCell>
                        <TableCell>
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                    <a href={asset.fileUrl} target="_blank" rel="noopener noreferrer">{t.adminLibrary.download}</a>
                                </DropdownMenuItem>
                                <EditAssetButton asset={asset} />
                                <DropdownMenuItem className="text-destructive" onSelect={() => handleDelete(asset)}>
                                    {t.common.delete}
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
