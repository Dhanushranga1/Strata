'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@/contexts/OrganizationContext';
import api from '@/lib/api-client';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import useSWR from 'swr';
import {
  Settings,
  Save,
  Clock,
  AlertCircle,
  Zap,
  List,
  LayoutList,
  Globe,
  Key,
  Copy,
  Trash2,
  Plus,
  ExternalLink,
} from 'lucide-react';

// ─── Priority metadata ────────────────────────────────────────────────────────
const PRIORITY_LABELS: Record<number, string> = {
  1: 'P1 — Lowest',
  2: 'P2 — Very Low',
  3: 'P3 — Low',
  4: 'P4 — Normal',
  5: 'P5 — High',
  6: 'P6 — Very High',
  7: 'P7 — Critical',
};
const PRIORITY_DEFAULTS: Record<
  number,
  { first_response: number; resolution: number }
> = {
  1: { first_response: 48, resolution: 168 },
  2: { first_response: 24, resolution: 72 },
  3: { first_response: 8, resolution: 48 },
  4: { first_response: 4, resolution: 24 },
  5: { first_response: 2, resolution: 12 },
  6: { first_response: 1, resolution: 6 },
  7: { first_response: 1, resolution: 4 },
};

export default function OrgSettingsPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const orgRole = currentOrganization?.your_role;

  // ─── Access guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (currentOrganization && orgRole !== 'owner' && orgRole !== 'admin') {
      router.replace('/dashboard');
    }
  }, [currentOrganization, orgRole, router]);

  // ─── General settings state ───────────────────────────────────────────────
  const [orgName, setOrgName] = useState('');
  const [orgDomain, setOrgDomain] = useState('');
  const [generalSaving, setGeneralSaving] = useState(false);

  const [overdueHours, setOverdueHours] = useState('48');
  const [reminderHours, setReminderHours] = useState('24');
  const [overdueSaving, setOverdueSaving] = useState(false);

  const [defaultEtrHours, setDefaultEtrHours] = useState('');
  const [etrSaving, setEtrSaving] = useState(false);

  // ─── SLA policies state ───────────────────────────────────────────────────
  type SLARow = { first_response_hours: string; resolution_hours: string };
  const [slaPolicies, setSlaPolicies] = useState<Record<number, SLARow>>(
    Object.fromEntries(
      [1, 2, 3, 4, 5, 6, 7].map(lvl => [
        lvl,
        {
          first_response_hours: String(PRIORITY_DEFAULTS[lvl].first_response),
          resolution_hours: String(PRIORITY_DEFAULTS[lvl].resolution),
        },
      ])
    )
  );
  const [slaSaving, setSlaSaving] = useState(false);
  const [slaLoaded, setSlaLoaded] = useState(false);

  // ─── Canned responses state ───────────────────────────────────────────────
  type CannedResponse = {
    id: string;
    title: string;
    body: string;
    tags: string[];
  };
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [cannedLoading, setCannedLoading] = useState(false);
  const [cannedTitle, setCannedTitle] = useState('');
  const [cannedBody, setCannedBody] = useState('');
  const [cannedEditId, setCannedEditId] = useState<string | null>(null);
  const [cannedFormOpen, setCannedFormOpen] = useState(false);
  const [cannedSaving, setCannedSaving] = useState(false);

  // ─── Custom fields state ──────────────────────────────────────────────────
  type FieldDef = {
    id: string;
    name: string;
    label: string;
    field_type: string;
    options: string[] | null;
    is_required: boolean;
    is_active: boolean;
    sort_order: number;
  };
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldFormOpen, setFieldFormOpen] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [fieldOptions, setFieldOptions] = useState('');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldSaving, setFieldSaving] = useState(false);

  // ─── Org slug (for portal URL) ────────────────────────────────────────────
  const [orgSlug, setOrgSlug] = useState('');

  // ─── API Keys state ───────────────────────────────────────────────────────
  type ApiKey = { id: string; name: string; key_prefix: string; is_active: boolean; last_used_at: string | null; expires_at: string | null; created_at: string };
  const { data: keysData, mutate: mutateKeys } = useSWR<{ keys: ApiKey[] }>(
    orgId ? '/api/keys' : null
  );
  const apiKeys = keysData?.keys ?? [];
  const [newKeyName, setNewKeyName] = useState('');
  const [keyCreating, setKeyCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  // ─── Load org data on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!orgId || !orgRole || (orgRole !== 'owner' && orgRole !== 'admin'))
      return;

    api
      .get<any>(`/api/organizations/${orgId}`, orgId)
      .then(data => {
        setOrgName(data.name ?? '');
        setOrgDomain(data.domain ?? '');
        setOrgSlug(data.slug ?? '');
        const s = data.settings || {};
        setOverdueHours(String(s.overdue_threshold_hours ?? 48));
        setReminderHours(String(s.overdue_reminder_hours ?? 24));
        if (s.default_etr_hours != null)
          setDefaultEtrHours(String(s.default_etr_hours));
      })
      .catch(() => {});
  }, [orgId, orgRole]);

  // ─── Load SLA policies ────────────────────────────────────────────────────
  const loadSlaPolicies = () => {
    if (!orgId) return;
    api
      .get<{
        policies: {
          priority_level: number;
          first_response_hours: number;
          resolution_hours: number;
        }[];
      }>('/api/sla', orgId)
      .then(data => {
        const map: Record<number, SLARow> = { ...slaPolicies };
        for (const p of data.policies) {
          map[p.priority_level] = {
            first_response_hours: String(p.first_response_hours),
            resolution_hours: String(p.resolution_hours),
          };
        }
        setSlaPolicies(map);
        setSlaLoaded(true);
      })
      .catch(() => setSlaLoaded(true));
  };

  // ─── Load canned responses ────────────────────────────────────────────────
  const loadCannedResponses = () => {
    if (!orgId) return;
    setCannedLoading(true);
    api
      .get<CannedResponse[]>('/api/canned-responses', orgId)
      .then(setCannedResponses)
      .catch(() => {})
      .finally(() => setCannedLoading(false));
  };

  // ─── Load custom field definitions ───────────────────────────────────────
  const loadFieldDefs = () => {
    if (!orgId) return;
    setFieldsLoading(true);
    api
      .get<FieldDef[]>('/api/custom-fields/defs', orgId)
      .then(setFieldDefs)
      .catch(() => {})
      .finally(() => setFieldsLoading(false));
  };

  // ─── Merge-safe PATCH helper ──────────────────────────────────────────────
  const patchOrgSettings = async (patch: Record<string, unknown>) => {
    const current = await api.get<any>(`/api/organizations/${orgId}`, orgId);
    await api.patch(
      `/api/organizations/${orgId}`,
      {
        settings: { ...(current.settings || {}), ...patch },
      },
      orgId
    );
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const saveGeneral = async () => {
    if (!orgId) return;
    try {
      setGeneralSaving(true);
      await api.patch(
        `/api/organizations/${orgId}`,
        { name: orgName, domain: orgDomain || null },
        orgId
      );
      toast.success('Organisation profile saved');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setGeneralSaving(false);
    }
  };

  const saveOverdue = async () => {
    if (!orgId) return;
    try {
      setOverdueSaving(true);
      await patchOrgSettings({
        overdue_threshold_hours: Number(overdueHours) || 48,
        overdue_reminder_hours: Number(reminderHours) || 24,
      });
      toast.success('Overdue settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setOverdueSaving(false);
    }
  };

  const saveDefaultEtr = async () => {
    if (!orgId) return;
    try {
      setEtrSaving(true);
      await patchOrgSettings({
        default_etr_hours: defaultEtrHours ? Number(defaultEtrHours) : null,
      });
      toast.success('Default ETR saved');
    } catch {
      toast.error('Failed to save ETR');
    } finally {
      setEtrSaving(false);
    }
  };

  const saveSlaPolicies = async () => {
    if (!orgId) return;
    try {
      setSlaSaving(true);
      const policies = [1, 2, 3, 4, 5, 6, 7].map(lvl => ({
        priority_level: lvl,
        first_response_hours:
          Number(slaPolicies[lvl].first_response_hours) ||
          PRIORITY_DEFAULTS[lvl].first_response,
        resolution_hours:
          Number(slaPolicies[lvl].resolution_hours) ||
          PRIORITY_DEFAULTS[lvl].resolution,
      }));
      await api.put('/api/sla', { policies }, orgId);
      toast.success('SLA policies saved');
    } catch {
      toast.error('Failed to save SLA policies');
    } finally {
      setSlaSaving(false);
    }
  };

  const saveCannedResponse = async () => {
    if (!orgId || !cannedTitle.trim() || !cannedBody.trim()) return;
    try {
      setCannedSaving(true);
      if (cannedEditId) {
        await api.patch(
          `/api/canned-responses/${cannedEditId}`,
          { title: cannedTitle, body: cannedBody },
          orgId
        );
        toast.success('Response updated');
      } else {
        await api.post(
          '/api/canned-responses',
          { title: cannedTitle, body: cannedBody, tags: [] },
          orgId
        );
        toast.success('Response created');
      }
      setCannedTitle('');
      setCannedBody('');
      setCannedEditId(null);
      setCannedFormOpen(false);
      loadCannedResponses();
    } catch {
      toast.error('Failed to save response');
    } finally {
      setCannedSaving(false);
    }
  };

  const deleteCannedResponse = async (id: string) => {
    if (!orgId) return;
    try {
      await api.delete(`/api/canned-responses/${id}`, orgId);
      setCannedResponses(prev => prev.filter(r => r.id !== id));
      toast.success('Response deleted');
    } catch {
      toast.error('Failed to delete response');
    }
  };

  const saveFieldDef = async () => {
    if (!orgId || !fieldName.trim() || !fieldLabel.trim()) return;
    try {
      setFieldSaving(true);
      const options =
        fieldType === 'select'
          ? fieldOptions
              .split(',')
              .map(o => o.trim())
              .filter(Boolean)
          : null;
      await api.post(
        '/api/custom-fields/defs',
        {
          name: fieldName.trim().toLowerCase().replace(/\s+/g, '_'),
          label: fieldLabel.trim(),
          field_type: fieldType,
          options,
          is_required: fieldRequired,
          sort_order: fieldDefs.length,
        },
        orgId
      );
      toast.success('Field created');
      setFieldName('');
      setFieldLabel('');
      setFieldType('text');
      setFieldOptions('');
      setFieldRequired(false);
      setFieldFormOpen(false);
      loadFieldDefs();
    } catch {
      toast.error('Failed to create field');
    } finally {
      setFieldSaving(false);
    }
  };

  const toggleFieldActive = async (def: FieldDef) => {
    if (!orgId) return;
    try {
      await api.patch(
        `/api/custom-fields/defs/${def.id}`,
        { is_active: !def.is_active },
        orgId
      );
      setFieldDefs(prev =>
        prev.map(f => (f.id === def.id ? { ...f, is_active: !f.is_active } : f))
      );
      toast.success(def.is_active ? 'Field deactivated' : 'Field activated');
    } catch {
      toast.error('Failed to update field');
    }
  };

  // ─── API Key handlers ─────────────────────────────────────────────────────
  const createApiKey = async () => {
    if (!orgId || !newKeyName.trim()) return;
    setKeyCreating(true);
    try {
      const result = await api.post<{ key: string; name: string; key_prefix: string }>(
        '/api/keys',
        { name: newKeyName.trim() },
        orgId
      );
      setRevealedKey(result.key);
      setNewKeyName('');
      mutateKeys();
      toast.success('API key created — save it now, it will not be shown again');
    } catch {
      toast.error('Failed to create API key');
    } finally {
      setKeyCreating(false);
    }
  };

  const revokeApiKey = async (id: string) => {
    if (!orgId) return;
    try {
      await api.delete(`/api/keys/${id}`, orgId);
      mutateKeys();
      toast.success('API key revoked');
    } catch {
      toast.error('Failed to revoke key');
    }
  };

  if (!currentOrganization || (orgRole !== 'owner' && orgRole !== 'admin'))
    return null;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Organisation Settings</h1>
          <p className="text-sm text-muted-foreground">
            {currentOrganization.name}
          </p>
        </div>
      </div>

      <Tabs
        defaultValue="general"
        onValueChange={tab => {
          if (tab === 'sla' && !slaLoaded) loadSlaPolicies();
          if (tab === 'canned') loadCannedResponses();
          if (tab === 'fields') loadFieldDefs();
        }}
      >
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="sla">SLA Policies</TabsTrigger>
          <TabsTrigger value="canned">Canned Responses</TabsTrigger>
          <TabsTrigger value="fields">Custom Fields</TabsTrigger>
          <TabsTrigger value="apikeys">API Keys</TabsTrigger>
        </TabsList>

        {/* ── GENERAL TAB ────────────────────────────────────────────────── */}
        <TabsContent value="general" className="space-y-6">
          {/* Org Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="w-4 h-4" /> Organisation Profile
              </CardTitle>
              <CardDescription>
                Display name and domain for your organisation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Organisation Name</Label>
                  <Input
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    placeholder="Acme Inc."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Domain{' '}
                    <span className="text-muted-foreground text-xs">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    value={orgDomain}
                    onChange={e => setOrgDomain(e.target.value)}
                    placeholder="acme.com"
                  />
                </div>
              </div>
              <Button onClick={saveGeneral} disabled={generalSaving} size="sm">
                <Save className="w-4 h-4 mr-1.5" />
                {generalSaving ? 'Saving…' : 'Save Profile'}
              </Button>
            </CardContent>
          </Card>

          {/* Overdue & Notification */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Overdue &amp; Notification
                Settings
              </CardTitle>
              <CardDescription>
                Control when tickets are marked overdue and how often reminder
                emails are sent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Mark ticket overdue after (hours)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={overdueHours}
                    onChange={e => setOverdueHours(e.target.value)}
                    placeholder="48"
                  />
                  <p className="text-xs text-muted-foreground">
                    Applied when no SLA policy or ETR is set.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Repeat reminder every (hours)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={reminderHours}
                    onChange={e => setReminderHours(e.target.value)}
                    placeholder="24"
                  />
                </div>
              </div>
              <Button onClick={saveOverdue} disabled={overdueSaving} size="sm">
                <Save className="w-4 h-4 mr-1.5" />
                {overdueSaving ? 'Saving…' : 'Save Overdue Settings'}
              </Button>
            </CardContent>
          </Card>

          {/* Default ETR */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" /> Default Resolution Time (ETR)
              </CardTitle>
              <CardDescription>
                Auto-set an expected resolution time on every new ticket.
                Overridden by per-priority SLA policies.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5 max-w-xs">
                <Label>
                  Default ETR (hours){' '}
                  <span className="text-muted-foreground text-xs">
                    — leave blank to disable
                  </span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={defaultEtrHours}
                  onChange={e => setDefaultEtrHours(e.target.value)}
                  placeholder="e.g. 48"
                />
              </div>
              <Button onClick={saveDefaultEtr} disabled={etrSaving} size="sm">
                <Save className="w-4 h-4 mr-1.5" />
                {etrSaving ? 'Saving…' : 'Save ETR'}
              </Button>
            </CardContent>
          </Card>

          {/* Customer Portal URL */}
          {orgSlug && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Customer Support Portal
                </CardTitle>
                <CardDescription>
                  Share this URL with your customers so they can submit and track support requests — no account needed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg border border-border">
                  <code className="flex-1 text-sm font-mono text-foreground break-all">
                    {typeof window !== 'undefined' ? `${window.location.origin}/portal/${orgSlug}` : `/portal/${orgSlug}`}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const url = `${window.location.origin}/portal/${orgSlug}`;
                      navigator.clipboard.writeText(url);
                      toast.success('Portal URL copied');
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <a
                    href={`/portal/${orgSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open customer portal in new tab"
                  >
                    <Button size="sm" variant="outline" aria-hidden>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">
                  Customers can submit requests with just their name and email — no Strata account required.
                  Replies sent through Strata will be visible when they return with their reference number.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── SLA POLICIES TAB ───────────────────────────────────────────── */}
        <TabsContent value="sla" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4" /> Priority-Based SLA Policies
              </CardTitle>
              <CardDescription>
                Set first-response and resolution targets for each priority
                level. These auto-set the ETR when a ticket is created.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">
                        Priority
                      </th>
                      <th className="text-left py-2 pr-4 font-medium">
                        First Response (hrs)
                      </th>
                      <th className="text-left py-2 font-medium">
                        Resolution (hrs)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[7, 6, 5, 4, 3, 2, 1].map(lvl => (
                      <tr key={lvl}>
                        <td className="py-2.5 pr-4 font-medium whitespace-nowrap">
                          {PRIORITY_LABELS[lvl]}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            className="w-28 h-8 text-sm"
                            value={slaPolicies[lvl]?.first_response_hours ?? ''}
                            placeholder={String(
                              PRIORITY_DEFAULTS[lvl].first_response
                            )}
                            onChange={e =>
                              setSlaPolicies(prev => ({
                                ...prev,
                                [lvl]: {
                                  ...prev[lvl],
                                  first_response_hours: e.target.value,
                                },
                              }))
                            }
                          />
                        </td>
                        <td className="py-2.5">
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            className="w-28 h-8 text-sm"
                            value={slaPolicies[lvl]?.resolution_hours ?? ''}
                            placeholder={String(
                              PRIORITY_DEFAULTS[lvl].resolution
                            )}
                            onChange={e =>
                              setSlaPolicies(prev => ({
                                ...prev,
                                [lvl]: {
                                  ...prev[lvl],
                                  resolution_hours: e.target.value,
                                },
                              }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={saveSlaPolicies} disabled={slaSaving} size="sm">
                <Save className="w-4 h-4 mr-1.5" />
                {slaSaving ? 'Saving…' : 'Save SLA Policies'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CANNED RESPONSES TAB ───────────────────────────────────────── */}
        <TabsContent value="canned" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <List className="w-4 h-4" /> Canned Responses
                  </CardTitle>
                  <CardDescription>
                    Pre-written replies reps can insert into ticket messages
                    with one click.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setCannedTitle('');
                    setCannedBody('');
                    setCannedEditId(null);
                    setCannedFormOpen(true);
                  }}
                >
                  + New Response
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* New / Edit form */}
              {cannedFormOpen && (
                <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input
                      value={cannedTitle}
                      onChange={e => setCannedTitle(e.target.value)}
                      placeholder="e.g. Thanks for reaching out"
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Body</Label>
                    <textarea
                      className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={cannedBody}
                      onChange={e => setCannedBody(e.target.value)}
                      placeholder="Type the response text here…"
                      maxLength={4000}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {cannedBody.length}/4000
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={saveCannedResponse}
                      disabled={
                        cannedSaving ||
                        !cannedTitle.trim() ||
                        !cannedBody.trim()
                      }
                    >
                      <Save className="w-4 h-4 mr-1.5" />
                      {cannedSaving
                        ? 'Saving…'
                        : cannedEditId
                          ? 'Update'
                          : 'Create'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCannedFormOpen(false);
                        setCannedEditId(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* List */}
              {cannedLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : cannedResponses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No canned responses yet. Create one above.
                </p>
              ) : (
                <div className="space-y-2">
                  {cannedResponses.map(r => (
                    <div
                      key={r.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {r.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {r.body}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setCannedEditId(r.id);
                            setCannedTitle(r.title);
                            setCannedBody(r.body);
                            setCannedFormOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => deleteCannedResponse(r.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CUSTOM FIELDS TAB ──────────────────────────────────────────── */}
        <TabsContent value="fields" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <LayoutList className="w-4 h-4" /> Custom Ticket Fields
                  </CardTitle>
                  <CardDescription>
                    Define extra fields that appear on every ticket in this
                    organisation.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => setFieldFormOpen(true)}>
                  + Add Field
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* New field form */}
              {fieldFormOpen && (
                <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>
                        Internal Name{' '}
                        <span className="text-muted-foreground text-xs">
                          (no spaces)
                        </span>
                      </Label>
                      <Input
                        value={fieldName}
                        onChange={e => setFieldName(e.target.value)}
                        placeholder="order_id"
                        maxLength={60}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Display Label</Label>
                      <Input
                        value={fieldLabel}
                        onChange={e => setFieldLabel(e.target.value)}
                        placeholder="Order ID"
                        maxLength={80}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Field Type</Label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={fieldType}
                        onChange={e => setFieldType(e.target.value)}
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="select">Select (dropdown)</option>
                        <option value="date">Date</option>
                        <option value="boolean">Yes/No</option>
                      </select>
                    </div>
                    {fieldType === 'select' && (
                      <div className="space-y-1.5">
                        <Label>
                          Options{' '}
                          <span className="text-muted-foreground text-xs">
                            (comma-separated)
                          </span>
                        </Label>
                        <Input
                          value={fieldOptions}
                          onChange={e => setFieldOptions(e.target.value)}
                          placeholder="Option A, Option B, Option C"
                        />
                      </div>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={fieldRequired}
                      onChange={e => setFieldRequired(e.target.checked)}
                      className="rounded"
                    />
                    Required field
                  </label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={saveFieldDef}
                      disabled={
                        fieldSaving || !fieldName.trim() || !fieldLabel.trim()
                      }
                    >
                      <Save className="w-4 h-4 mr-1.5" />
                      {fieldSaving ? 'Saving…' : 'Create Field'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFieldFormOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Fields list */}
              {fieldsLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : fieldDefs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No custom fields defined yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-4 font-medium">
                          Label
                        </th>
                        <th className="text-left py-2 pr-4 font-medium">
                          Name
                        </th>
                        <th className="text-left py-2 pr-4 font-medium">
                          Type
                        </th>
                        <th className="text-left py-2 pr-4 font-medium">
                          Required
                        </th>
                        <th className="text-left py-2 font-medium">Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {fieldDefs.map(f => (
                        <tr
                          key={f.id}
                          className={!f.is_active ? 'opacity-50' : ''}
                        >
                          <td className="py-2.5 pr-4 font-medium">{f.label}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground font-mono text-xs">
                            {f.name}
                          </td>
                          <td className="py-2.5 pr-4 capitalize">
                            {f.field_type}
                          </td>
                          <td className="py-2.5 pr-4">
                            {f.is_required ? 'Yes' : 'No'}
                          </td>
                          <td className="py-2.5">
                            <button
                              type="button"
                              onClick={() => toggleFieldActive(f)}
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                f.is_active
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {f.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── API KEYS TAB ───────────────────────────────────────────────── */}
        <TabsContent value="apikeys" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="w-4 h-4" /> API Keys
              </CardTitle>
              <CardDescription>
                Create keys to access the Strata API from your own scripts, integrations, or webhooks.
                Each key is shown <strong>once</strong> — store it securely.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Revealed key banner */}
              {revealedKey && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                  <p className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
                    <Key className="w-4 h-4" /> Your new API key — copy it now
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-sm break-all text-foreground bg-background border border-border rounded-lg px-3 py-2">
                      {revealedKey}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { navigator.clipboard.writeText(revealedKey); toast.success('Copied!'); }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-amber-400/80">
                    This key will not be shown again. Store it in a password manager or secrets vault.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setRevealedKey(null)}>
                    I have saved it — dismiss
                  </Button>
                </div>
              )}

              {/* Create new key */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="Key name (e.g. Zapier integration)"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  onKeyDown={e => { if (e.key === 'Enter') createApiKey(); }}
                />
                <Button onClick={createApiKey} disabled={keyCreating || !newKeyName.trim()} size="sm">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {keyCreating ? 'Creating…' : 'Create key'}
                </Button>
              </div>

              {/* Keys list */}
              {apiKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No API keys yet. Create one above to get programmatic access.
                </p>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {apiKeys.map(k => (
                    <div key={k.id} className="flex items-center justify-between px-4 py-3 gap-4 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{k.name}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{k.key_prefix}••••••••</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                        {k.last_used_at
                          ? <span>Last used {new Date(k.last_used_at).toLocaleDateString()}</span>
                          : <span>Never used</span>
                        }
                        {k.expires_at && (
                          <span>Expires {new Date(k.expires_at).toLocaleDateString()}</span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full font-medium ${k.is_active ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                          {k.is_active ? 'Active' : 'Revoked'}
                        </span>
                        {k.is_active && (
                          <button
                            type="button"
                            onClick={() => revokeApiKey(k.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            title="Revoke key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Include your key in the <code className="bg-muted px-1 rounded text-xs">Authorization: Bearer &lt;key&gt;</code> header
                and your org ID in <code className="bg-muted px-1 rounded text-xs">X-Organization-ID</code>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
