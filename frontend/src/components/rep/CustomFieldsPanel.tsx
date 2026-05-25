'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api-client';

interface FieldDef {
  id: string;
  name: string;
  label: string;
  field_type: 'text' | 'number' | 'select' | 'date' | 'boolean';
  options: string[] | null;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
}

interface TicketFieldEntry {
  field_def: FieldDef;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_bool: boolean | null;
}

interface CustomFieldsPanelProps {
  ticketId: string;
  orgId: string;
}

export function CustomFieldsPanel({ ticketId, orgId }: CustomFieldsPanelProps) {
  const [entries, setEntries] = useState<TicketFieldEntry[]>([]);
  const [values, setValues] = useState<
    Record<
      string,
      { text?: string; number?: number; date?: string; bool?: boolean }
    >
  >({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api
      .get<TicketFieldEntry[]>(`/api/custom-fields/tickets/${ticketId}`, orgId)
      .then(data => {
        setEntries(data);
        const init: typeof values = {};
        for (const e of data) {
          init[e.field_def.id] = {
            text: e.value_text ?? undefined,
            number: e.value_number ?? undefined,
            date: e.value_date ?? undefined,
            bool: e.value_bool ?? undefined,
          };
        }
        setValues(init);
      })
      .catch(() => {});
  }, [ticketId, orgId]);

  const save = useCallback(
    (updated: typeof values) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const payload = entries.map(e => ({
          field_def_id: e.field_def.id,
          value_text: updated[e.field_def.id]?.text ?? null,
          value_number: updated[e.field_def.id]?.number ?? null,
          value_date: updated[e.field_def.id]?.date ?? null,
          value_bool: updated[e.field_def.id]?.bool ?? null,
        }));
        api
          .patch(
            `/api/custom-fields/tickets/${ticketId}`,
            { values: payload },
            orgId
          )
          .catch(() => {});
      }, 500);
    },
    [entries, ticketId, orgId]
  );

  const update = (fieldId: string, patch: Partial<(typeof values)[string]>) => {
    const next = { ...values, [fieldId]: { ...values[fieldId], ...patch } };
    setValues(next);
    save(next);
  };

  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Custom Fields</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map(({ field_def: f }) => {
          const val = values[f.id] ?? {};
          return (
            <div key={f.id} className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {f.label}
                {f.is_required && (
                  <span className="text-red-500 ml-0.5">*</span>
                )}
              </Label>
              {f.field_type === 'boolean' ? (
                <Switch
                  checked={val.bool ?? false}
                  onCheckedChange={v => update(f.id, { bool: v })}
                />
              ) : f.field_type === 'select' ? (
                <Select
                  value={val.text ?? ''}
                  onValueChange={v => update(f.id, { text: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(f.options ?? []).map(opt => (
                      <SelectItem key={opt} value={opt} className="text-xs">
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.field_type === 'number' ? (
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={val.number ?? ''}
                  onChange={e =>
                    update(f.id, {
                      number: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                />
              ) : f.field_type === 'date' ? (
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={val.date ?? ''}
                  onChange={e =>
                    update(f.id, { date: e.target.value || undefined })
                  }
                />
              ) : (
                <Input
                  type="text"
                  className="h-8 text-xs"
                  value={val.text ?? ''}
                  onChange={e =>
                    update(f.id, { text: e.target.value || undefined })
                  }
                />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
