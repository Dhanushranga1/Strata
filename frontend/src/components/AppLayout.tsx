import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { supabase } from "@/lib/supabaseClient";

interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      console.log('🔍 AppLayout: Starting user authentication check...');
      
      try {
        // Use Supabase session instead of localStorage
        console.log('🔑 AppLayout: Getting Supabase session...');
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        
        console.log('🔑 AppLayout: Token from Supabase session:', token ? 'EXISTS' : 'NOT_FOUND');
        
        if (!token) {
          console.log('❌ AppLayout: No session found, redirecting to login');
          router.push('/login');
          return;
        }

        console.log('🌐 AppLayout: Making API request to /api/me...');
        const response = await fetch('http://127.0.0.1:8000/api/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        console.log('📡 AppLayout: API response status:', response.status);

        if (response.ok) {
          const userData = await response.json();
          console.log('✅ AppLayout: User data received:', { id: userData.id, email: userData.email, role: userData.role });
          setUser(userData);
        } else {
          console.log('❌ AppLayout: API request failed, signing out and redirecting');
          await supabase.auth.signOut();
          router.push('/login');
        }
      } catch (error) {
        console.error('💥 AppLayout: Failed to fetch user:', error);
        await supabase.auth.signOut();
        router.push('/login');
      } finally {
        console.log('🏁 AppLayout: Authentication check complete');
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar 
        userRole={user?.role} 
        userName={user?.name || user?.email} 
        userEmail={user?.email} 
      />
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}