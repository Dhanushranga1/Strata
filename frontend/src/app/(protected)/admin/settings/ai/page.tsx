'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import api from '@/lib/api-client';
import { toast } from 'sonner';
import { ArrowLeft, Save, Eye, EyeOff, Brain, Wrench } from 'lucide-react';

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://127.0.0.1:8000'
).replace(/\/$/, '');

interface AiConfig {
  gen_model: string;
  gen_api_key: string;
  gen_api_base: string;
  temperature: number;
  max_tokens: number;
  embed_model: string;
  embed_api_key: string;
  embed_dim: number;
}

export default function AiSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showGenKey, setShowGenKey] = useState(false);
  const [showEmbedKey, setShowEmbedKey] = useState(false);
  const [config, setConfig] = useState<AiConfig>({
    gen_model: '',
    gen_api_key: '',
    gen_api_base: '',
    temperature: 0.2,
    max_tokens: 1024,
    embed_model: '',
    embed_api_key: '',
    embed_dim: 3072,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) {
        setLoading(false);
        return;
      }

      const resp = await fetch(`${API_BASE}/api/admin/ai-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        setConfig(await resp.json());
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;

      const resp = await fetch(`${API_BASE}/api/admin/ai-settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      if (resp.ok) {
        toast.success('AI settings saved');
      } else {
        toast.error('Failed to save');
      }
    } catch {
      toast.error('Network error');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/admin/settings')}
          className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </button>
        <Brain className="w-6 h-6 text-purple-400" />
        <div>
          <h1 className="text-lg font-semibold">AI Configuration</h1>
          <p className="text-sm text-zinc-500">
            Bring your own API keys — no server env changes needed
          </p>
        </div>
      </div>

      {/* Generation */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <Wrench className="w-4 h-4" /> Generation
        </h2>
        <p className="text-xs text-zinc-500">
          Model prefixes: gemini-* → Google, gpt-* → OpenAI, claude-* →
          Anthropic, llama-*/mixtral-* → Groq/Together
        </p>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Model name</label>
          <input
            value={config.gen_model}
            onChange={e =>
              setConfig(p => ({ ...p, gen_model: e.target.value }))
            }
            placeholder="gemini-2.0-flash"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">API key</label>
          <div className="relative">
            <input
              type={showGenKey ? 'text' : 'password'}
              value={config.gen_api_key}
              onChange={e =>
                setConfig(p => ({ ...p, gen_api_key: e.target.value }))
              }
              placeholder="Set or leave blank to use env var"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <button
              type="button"
              onClick={() => setShowGenKey(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showGenKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">
            API base URL{' '}
            <span className="text-zinc-600">
              (optional, for OpenAI-compatible providers)
            </span>
          </label>
          <input
            value={config.gen_api_base}
            onChange={e =>
              setConfig(p => ({ ...p, gen_api_base: e.target.value }))
            }
            placeholder="https://api.groq.com/openai/v1"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs text-zinc-400 mb-1 block">
              Temperature
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={config.temperature}
              onChange={e =>
                setConfig(p => ({
                  ...p,
                  temperature: parseFloat(e.target.value) || 0,
                }))
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-zinc-400 mb-1 block">
              Max tokens
            </label>
            <input
              type="number"
              step="1"
              min="64"
              max="8192"
              value={config.max_tokens}
              onChange={e =>
                setConfig(p => ({
                  ...p,
                  max_tokens: parseInt(e.target.value) || 0,
                }))
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>
      </section>

      {/* Embeddings */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <Brain className="w-4 h-4" /> Embeddings
        </h2>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">
            Embedding model
          </label>
          <input
            value={config.embed_model}
            onChange={e =>
              setConfig(p => ({ ...p, embed_model: e.target.value }))
            }
            placeholder="gemini-embedding-001"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">API key</label>
          <div className="relative">
            <input
              type={showEmbedKey ? 'text' : 'password'}
              value={config.embed_api_key}
              onChange={e =>
                setConfig(p => ({ ...p, embed_api_key: e.target.value }))
              }
              placeholder="Leave blank to use generation key"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <button
              type="button"
              onClick={() => setShowEmbedKey(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showEmbedKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">
            Vector dimension{' '}
            <span className="text-zinc-600">
              (auto-detected, override if needed)
            </span>
          </label>
          <input
            type="number"
            step="1"
            min="64"
            max="8192"
            value={config.embed_dim}
            onChange={e =>
              setConfig(p => ({
                ...p,
                embed_dim: parseInt(e.target.value) || 0,
              }))
            }
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
      </section>

      {/* Save */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 text-white font-medium text-sm hover:bg-purple-500 disabled:opacity-50 transition-colors"
      >
        {saving ? (
          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {saving ? 'Saving...' : 'Save AI Configuration'}
      </button>
    </div>
  );
}
