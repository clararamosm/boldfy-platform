import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle, LogIn } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function MasterEmpresasPage() {
    const addCompanyButton = (
        <Button size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar Empresa
        </Button>
    );

    const companyForm = (
        <>
            <div className="space-y-2">
                <Label htmlFor="company-name">Nome da Empresa</Label>
                <Input id="company-name" placeholder="Ex: TechCorp" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="admin-email">E-mail do Admin</Label>
                <Input id="admin-email" type="email" placeholder="admin@techcorp.com" />
            </div>
             <div className="space-y-2">
                <Label htmlFor="licenses">Número de Licenças</Label>
                <Input id="licenses" type="number" placeholder="Ex: 100" />
            </div>
        </>
    );

  return (
    <>
      <Header title="Empresas" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="font-headline">Gerenciamento de Empresas</CardTitle>
                    <CardDescription>Adicione, edite ou remova empresas clientes.</CardDescription>
                </div>
                <ActionDialog
                    title="Adicionar Nova Empresa"
                    description="Cadastre uma nova empresa cliente na plataforma."
                    trigger={addCompanyButton}
                    actionText="Salvar Empresa"
                >
                    {companyForm}
                </ActionDialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Licenças</TableHead>
                            <TableHead>Admin</TableHead>
                            <TableHead>Data de Início</TableHead>
                            <TableHead><span className="sr-only">Ações</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="font-medium">TechCorp</TableCell>
                            <TableCell><Badge variant="default">Ativa</Badge></TableCell>
                            <TableCell>100 / 100</TableCell>
                            <TableCell>admin.techcorp@example.com</TableCell>
                            <TableCell>2023-01-15</TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Toggle menu</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                        <DropdownMenuItem asChild>
                                            <Link href="/admin/dashboard"><LogIn className="mr-2 h-4 w-4" />Visualizar Ambiente</Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>Editar</DropdownMenuItem>
                                        <DropdownMenuItem>Desativar</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                         <TableRow>
                            <TableCell className="font-medium">Innovate Inc.</TableCell>
                            <TableCell><Badge variant="default">Ativa</Badge></TableCell>
                            <TableCell>45 / 50</TableCell>
                            <TableCell>admin.innovate@example.com</TableCell>
                            <TableCell>2023-03-01</TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Toggle menu</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                        <DropdownMenuItem asChild>
                                            <Link href="/admin/dashboard"><LogIn className="mr-2 h-4 w-4" />Visualizar Ambiente</Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>Editar</DropdownMenuItem>
                                        <DropdownMenuItem>Desativar</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Future Solutions</TableCell>
                            <TableCell><Badge variant="destructive">Inativa</Badge></TableCell>
                            <TableCell>0 / 25</TableCell>
                            <TableCell>admin.future@example.com</TableCell>
                             <TableCell>2023-05-20</TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Toggle menu</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                         <DropdownMenuItem asChild>
                                            <Link href="/admin/dashboard"><LogIn className="mr-2 h-4 w-4" />Visualizar Ambiente</Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>Editar</DropdownMenuItem>
                                        <DropdownMenuItem>Ativar</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </main>
    </>
  );
}
