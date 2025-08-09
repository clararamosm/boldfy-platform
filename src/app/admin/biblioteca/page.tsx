// src/app/admin/biblioteca/page.tsx
'use client';

import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, FileText, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Asset = {
    name: string;
    type: string;
    category: 'Posts' | 'Materiais Ricos' | 'Assets de Marca';
    uploadDate: string;
    icon: React.ReactNode;
};

const assets: Asset[] = [
    { name: "Banner LinkedIn - Lançamento", type: "PNG", category: "Posts", uploadDate: "2024-07-15", icon: <ImageIcon className="h-5 w-5 text-muted-foreground" /> },
    { name: "Guia de Tom de Voz", type: "PDF", category: "Assets de Marca", uploadDate: "2024-06-20", icon: <FileText className="h-5 w-5 text-muted-foreground" /> },
    { name: "Ebook sobre IA", type: "PDF", category: "Materiais Ricos", uploadDate: "2024-07-18", icon: <FileText className="h-5 w-5 text-muted-foreground" /> },
];

const AssetForm = ({ asset }: { asset?: Asset }) => (
    <>
        <div className="space-y-2">
            <Label htmlFor="asset-name">Nome do Ativo</Label>
            <Input id="asset-name" placeholder="Ex: Banner para LinkedIn" defaultValue={asset?.name} />
        </div>
        <div className="space-y-2">
            <Label htmlFor="asset-category">Categoria</Label>
            <Select defaultValue={asset?.category}>
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
            <Input id="asset-file" type="file" />
        </div>
    </>
);

const EditAssetButton = ({ asset }: { asset: Asset }) => (
     <ActionDialog
        title="Editar Ativo"
        description="Atualize as informações ou troque o arquivo do ativo."
        trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Editar</DropdownMenuItem>}
        actionText="Salvar Alterações"
    >
        <AssetForm asset={asset} />
    </ActionDialog>
);


export default function AdminBibliotecaPage() {
  const uploadButton = (
     <Button size="sm">
        <PlusCircle className="mr-2 h-4 w-4" />
        Novo Upload
      </Button>
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
              actionText="Fazer Upload"
            >
              <AssetForm />
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
                {assets.map((asset) => (
                    <TableRow key={asset.name}>
                        <TableCell className="font-medium flex items-center gap-2">
                            {asset.icon}
                            {asset.name}
                        </TableCell>
                        <TableCell>{asset.type}</TableCell>
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
                                <DropdownMenuItem>Baixar</DropdownMenuItem>
                                <EditAssetButton asset={asset} />
                                <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
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
