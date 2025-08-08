import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex items-center justify-center">
               <Logo />
            </div>
            <CardTitle className="font-headline text-3xl">Boldfy</CardTitle>
            <CardDescription>Sign in to start your journey as a brand influencer.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="m@example.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required />
              </div>
              <Button type="submit" className="w-full font-bold">
                Login
              </Button>
            </form>
            <div className="mt-6 space-y-2 text-center">
                <p className="text-sm text-muted-foreground">For demonstration purposes:</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild variant="outline" className="w-full">
                        <Link href="/influencer/trilhas">Sign in as Influencer</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full">
                        <Link href="/admin/dashboard">Sign in as Admin</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full">
                        <Link href="/master/dashboard">Sign in as Master</Link>
                    </Button>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
