"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Building2,
  BookOpen,
  Users,
  Rocket,
  CheckCircle2,
  ChevronRight,
  Upload,
  Plus,
  X,
  Loader2,
  ArrowRight,
} from "lucide-react";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? "";
}

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, icon: Building2, label: "Workspace" },
  { id: 2, icon: BookOpen,  label: "Knowledge" },
  { id: 3, icon: Users,     label: "Team" },
  { id: 4, icon: Rocket,    label: "Launch" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = step.id < current;
        const active = step.id === current;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  "w-9 h-9 rounded-full flex items-center justify-center border transition-all duration-300",
                  done
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : active
                    ? "bg-zinc-900 border-indigo-500 text-indigo-400"
                    : "bg-zinc-900 border-zinc-700 text-zinc-600",
                ].join(" ")}
              >
                {done ? (
                  <CheckCircle2 className="w-4.5 h-4.5" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span
                className={[
                  "text-[11px] font-medium hidden sm:block",
                  active ? "text-indigo-400" : done ? "text-zinc-400" : "text-zinc-600",
                ].join(" ")}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={[
                  "w-16 sm:w-24 h-px mb-5 transition-colors duration-300",
                  step.id < current ? "bg-indigo-600" : "bg-zinc-800",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      key="card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-lg"
    >
      {children}
    </motion.div>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function Step1({
  onNext,
  orgId,
  initialName,
}: {
  onNext: () => void;
  orgId: string;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleNext = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Workspace name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/organizations/${orgId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Organization-ID": orgId,
        },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error(await res.text());
      onNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center mb-4">
          <Building2 className="w-5 h-5 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-white font-geist mb-1">Name your workspace</h2>
        <p className="text-sm text-zinc-400">This is what your team and customers will see.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Workspace name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleNext()}
            placeholder="Acme Support"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
          {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
        </div>

        <button
          onClick={handleNext}
          disabled={saving || !name.trim()}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ChevronRight className="w-4 h-4" /></>}
        </button>
      </div>
    </Card>
  );
}

function Step2({ onNext, onSkip, orgId }: { onNext: () => void; onSkip: () => void; orgId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const token = await getToken();
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/api/kb/ingest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Organization-ID": orgId,
        },
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <div className="mb-6">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center mb-4">
          <BookOpen className="w-5 h-5 text-violet-400" />
        </div>
        <h2 className="text-xl font-bold text-white font-geist mb-1">Add your first doc</h2>
        <p className="text-sm text-zinc-400">
          Upload a PDF, DOCX, Markdown, or text file. CASPER will embed it into your knowledge base
          so AI answers can cite it immediately.
        </p>
      </div>

      <div className="space-y-4">
        {done ? (
          <div className="flex items-center gap-2.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span><strong>{file?.name}</strong> uploaded and indexed.</span>
          </div>
        ) : (
          <>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl p-6 text-center cursor-pointer transition-colors"
            >
              <Upload className="w-6 h-6 text-zinc-500 mx-auto mb-2" />
              {file ? (
                <p className="text-sm text-zinc-300">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm text-zinc-400">Click to choose a file</p>
                  <p className="text-xs text-zinc-600 mt-1">PDF, DOCX, MD, TXT</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.md,.txt,.markdown"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(""); }}
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            {file && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4" /> Upload & Index</>}
              </button>
            )}
          </>
        )}

        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 text-sm text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 rounded-lg px-4 py-2.5 transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={onNext}
            disabled={!done && !file === false && true}
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}

function Step3({ onNext, onSkip, orgId }: { onNext: () => void; onSkip: () => void; orgId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"rep" | "admin">("rep");
  const [sent, setSent] = useState<{ email: string; role: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) { setError("Enter a valid email"); return; }
    if (sent.some((s) => s.email === trimmed)) { setError("Already invited"); return; }
    setSending(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/organizations/${orgId}/invites`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Organization-ID": orgId,
        },
        body: JSON.stringify({ email: trimmed, role }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSent((prev) => [...prev, { email: trimmed, role }]);
      setEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <div className="mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mb-4">
          <Users className="w-5 h-5 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white font-geist mb-1">Invite your team</h2>
        <p className="text-sm text-zinc-400">
          Reps handle tickets; admins manage the workspace. Everyone gets an email invite.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            placeholder="teammate@company.com"
            type="email"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "rep" | "admin")}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2.5 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="rep">Rep</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={handleInvite}
            disabled={sending || !email.trim()}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-3 py-2.5 transition-colors shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {sent.length > 0 && (
          <div className="space-y-1.5">
            {sent.map((s) => (
              <div key={s.email} className="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-sm text-zinc-300 flex-1">{s.email}</span>
                <span className="text-xs text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5 uppercase tracking-wider">{s.role}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onSkip}
            className="flex-1 text-sm text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 rounded-lg px-4 py-2.5 transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={onNext}
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}

function Step4({ orgId, refreshOrganizations }: { orgId: string; refreshOrganizations: () => Promise<void> }) {
  const router = useRouter();
  const [launching, setLaunching] = useState(false);

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/api/organizations/${orgId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Organization-ID": orgId,
        },
        body: JSON.stringify({ settings: { onboarding_completed: true } }),
      });
      await refreshOrganizations();
      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    }
  };

  const highlights = [
    { color: "text-indigo-400", label: "CASPER auto-routes every incoming ticket" },
    { color: "text-violet-400", label: "AI drafts cited answers from your KB" },
    { color: "text-emerald-400", label: "P1–P7 priority scoring — zero manual triage" },
    { color: "text-orange-400", label: "Confidence-based escalation to your reps" },
  ];

  return (
    <Card>
      <div className="mb-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center mx-auto mb-4">
          <Rocket className="w-7 h-7 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-white font-geist mb-2">You&apos;re all set!</h2>
        <p className="text-sm text-zinc-400">
          Your workspace is ready. Here&apos;s what&apos;s working for you from minute one:
        </p>
      </div>

      <ul className="space-y-2.5 mb-6">
        {highlights.map((h) => (
          <li key={h.label} className="flex items-start gap-2.5">
            <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${h.color}`} />
            <span className="text-sm text-zinc-300">{h.label}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={handleLaunch}
        disabled={launching}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-4 py-3 transition-colors"
      >
        {launching ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>Open Dashboard <ArrowRight className="w-4 h-4" /></>
        )}
      </button>
    </Card>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const { currentOrganization, refreshOrganizations } = useOrganization();

  const orgId = currentOrganization?.id ?? "";
  const orgName = currentOrganization?.name ?? "";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
      <div className="mb-10 text-center">
        <p className="text-zinc-500 text-sm mb-1">Setting up</p>
        <h1 className="text-2xl font-bold text-white font-geist tracking-tight">
          Welcome to TicketPilot
        </h1>
      </div>

      {/* Step indicator */}
      <div className="mb-10">
        <StepIndicator current={step} />
      </div>

      {/* Step cards */}
      <AnimatePresence mode="wait">
        {step === 1 && (
          <Step1
            key="step1"
            orgId={orgId}
            initialName={orgName}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2
            key="step2"
            orgId={orgId}
            onNext={() => setStep(3)}
            onSkip={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <Step3
            key="step3"
            orgId={orgId}
            onNext={() => setStep(4)}
            onSkip={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <Step4
            key="step4"
            orgId={orgId}
            refreshOrganizations={refreshOrganizations}
          />
        )}
      </AnimatePresence>

      {/* Footer */}
      <p className="mt-8 text-xs text-zinc-600">
        Step {step} of {STEPS.length}
      </p>
    </div>
  );
}
