"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  Settings, 
  Save,
  RefreshCw,
  Mail,
  Bell,
  Shield,
  Database,
  Globe
} from "lucide-react";

export default function AdminSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null);
  const [settings, setSettings] = useState({
    siteTitle: "TicketPilot",
    siteDomain: "localhost:3000",
    emailNotifications: true,
    autoAssignTickets: true,
    requireApproval: true,
    maxFileSize: "10",
    sessionTimeout: "24",
    backupEnabled: true,
    maintenanceMode: false,
    debugMode: false
  });

  useEffect(() => {
    const checkAuth = async () => {
      console.log('⚙️ Admin Settings: Starting authentication check...');
      try {
        // Use Supabase session instead of localStorage
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        
        console.log('🔑 Admin Settings: Token from Supabase session:', token ? 'EXISTS' : 'NOT_FOUND');
        
        if (!token) {
          console.log('❌ Admin Settings: No session found, redirecting to login');
          router.push('/login');
          return;
        }

        console.log('🌐 Admin Settings: Making API request to /api/me...');
        const response = await fetch(`${API_BASE}/api/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        console.log('📡 Admin Settings: API response status:', response.status);

        if (response.ok) {
          const userData = await response.json();
          console.log('👤 Admin Settings: User data received:', userData);
          console.log('🔐 Admin Settings: User role:', userData.role);
          
          if (userData.role !== 'admin') {
            console.log('⛔ Admin Settings: User is not admin, redirecting to dashboard');
            router.push('/dashboard');
            return;
          }

          console.log('✅ Admin Settings: Admin authentication successful');
          setUser(userData);
        } else {
          console.log('❌ Admin Settings: API request failed, redirecting to login');
          await supabase.auth.signOut();
          router.push('/login');
          return;
        }
      } catch (error) {
        console.error('💥 Admin Settings: Authentication error:', error);
        await supabase.auth.signOut();
        router.push('/login');
        return;
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleSaveSettings = () => {
    // Here you would save settings to the backend
    console.log('Saving settings:', settings);
    // Show success message
  };

  const loadDiagnostics = async () => {
    setDiagnosticsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      const response = await fetch(`${API_BASE}/api/admin/diagnostics/db`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDiagnosticsData(data);
      } else {
        console.error('Failed to load diagnostics');
      }
    } catch (error) {
      console.error('Error loading diagnostics:', error);
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
            <p className="text-muted-foreground">
              Configure system-wide settings and preferences
            </p>
          </div>
        </div>
        <Button onClick={handleSaveSettings}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              General Settings
            </CardTitle>
            <CardDescription>Basic site configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="siteTitle">Site Title</Label>
              <Input
                id="siteTitle"
                value={settings.siteTitle}
                onChange={(e) => setSettings({...settings, siteTitle: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteDomain">Site Domain</Label>
              <Input
                id="siteDomain"
                value={settings.siteDomain}
                onChange={(e) => setSettings({...settings, siteDomain: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Session Timeout (hours)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                value={settings.sessionTimeout}
                onChange={(e) => setSettings({...settings, sessionTimeout: e.target.value})}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Email and notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Send email notifications for new tickets</p>
              </div>
              <Switch
                checked={settings.emailNotifications}
                onCheckedChange={(checked: boolean) => setSettings({...settings, emailNotifications: checked})}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-assign Tickets</Label>
                <p className="text-sm text-muted-foreground">Automatically assign tickets to available reps</p>
              </div>
              <Switch
                checked={settings.autoAssignTickets}
                onCheckedChange={(checked: boolean) => setSettings({...settings, autoAssignTickets: checked})}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>Security and access control settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Role Approval</Label>
                <p className="text-sm text-muted-foreground">Admin approval required for role changes</p>
              </div>
              <Switch
                checked={settings.requireApproval}
                onCheckedChange={(checked: boolean) => setSettings({...settings, requireApproval: checked})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxFileSize">Max File Upload Size (MB)</Label>
              <Input
                id="maxFileSize"
                type="number"
                value={settings.maxFileSize}
                onChange={(e) => setSettings({...settings, maxFileSize: e.target.value})}
              />
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              System
            </CardTitle>
            <CardDescription>System maintenance and debugging</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Backup Enabled</Label>
                <p className="text-sm text-muted-foreground">Automatic daily backups</p>
              </div>
              <Switch
                checked={settings.backupEnabled}
                onCheckedChange={(checked: boolean) => setSettings({...settings, backupEnabled: checked})}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">Block user access for maintenance</p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(checked: boolean) => setSettings({...settings, maintenanceMode: checked})}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Debug Mode</Label>
                <p className="text-sm text-muted-foreground">Enable detailed error logging</p>
              </div>
              <Switch
                checked={settings.debugMode}
                onCheckedChange={(checked: boolean) => setSettings({...settings, debugMode: checked})}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database Diagnostics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Diagnostics
          </CardTitle>
          <CardDescription>System health and database information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 mb-4">
            <Button 
              onClick={loadDiagnostics}
              disabled={diagnosticsLoading}
              variant="outline"
            >
              {diagnosticsLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              {diagnosticsLoading ? 'Loading...' : 'Run Diagnostics'}
            </Button>
          </div>
          
          {diagnosticsData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Database Version</Label>
                  <p className="text-sm text-muted-foreground">{diagnosticsData.database_version}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Last Check</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(diagnosticsData.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Table Counts</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  {Object.entries(diagnosticsData.table_counts || {}).map(([table, count]) => (
                    <div key={table} className="flex justify-between p-2 bg-muted rounded">
                      <span className="font-mono">{table}</span>
                      <span className="font-semibold">{String(count)}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Installed Extensions</Label>
                <div className="flex flex-wrap gap-1">
                  {diagnosticsData.extensions?.map((ext: string) => (
                    <span key={ext} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {ext}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Clear Cache
            </Button>
            <Button variant="outline">
              <Database className="h-4 w-4 mr-2" />
              Backup Database
            </Button>
            <Button variant="outline">
              <Mail className="h-4 w-4 mr-2" />
              Test Email
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}