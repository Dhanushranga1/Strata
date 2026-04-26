"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/contexts/OrganizationContext";
import api from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000").replace(/\/$/, "");
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Upload,
  Search,
  FileText,
  Database,
  AlertCircle,
  CheckCircle,
  Loader2,
  X
} from "lucide-react";
import { PageShell } from "@/ui/motion/PageShell";
import { m } from "framer-motion";
import { v } from "@/ui/motion/variants";

interface KBStats {
  documents: number;
  chunks: number;
}

interface SearchResult {
  faiss_id: number;
  score: number;
  document_id?: string;
  chunk_id?: string;
  text_preview?: string;
}

interface IngestResponse {
  document_id: string;
  chunks_ingested: number;
  vectors_added: number;
}

interface DocumentItem {
  id: string;
  title: string;
  source_type: string;
  chunk_count: number;
  created_at: string;
}

export default function KnowledgeBasePage() {
  const router = useRouter();
  const { currentOrganization, isReady } = useOrganization();
  const orgId = currentOrganization?.id;

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<KBStats | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [filename, setFilename] = useState("");

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsFilter, setDocumentsFilter] = useState("");

  useEffect(() => {
    if (!isReady || !orgId) {
      setLoading(true);
      return;
    }

    const checkAuth = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          router.push("/login");
          return;
        }
        const userInfo = await api.get("/api/me");
        if (userInfo.role === 'customer') {
          router.replace('/tickets');
          return;
        }
        setUser(userInfo);
        await loadStats();
      } catch {
        await supabase.auth.signOut();
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, isReady, orgId]);

  const loadStats = async () => {
    if (!orgId) return;
    try {
      const statsData = await api.get<KBStats>("/api/kb/stats", orgId);
      setStats(statsData);
    } catch {
      // non-fatal
    }
  };

  const loadDocuments = async () => {
    if (!orgId) return;
    setDocumentsLoading(true);
    try {
      const docs = await api.get<DocumentItem[]>("/api/kb/documents", orgId);
      setDocuments(docs);
    } catch {
      setDocuments([]);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !orgId) return;
    setSearchLoading(true);
    try {
      const results = await api.get<SearchResult[]>(
        `/api/kb/search?q=${encodeURIComponent(searchQuery)}&k=5`,
        orgId
      );
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile && !rawText.trim()) {
      setUploadMessage({ type: "error", message: "Please select a file or enter raw text" });
      return;
    }
    if (!orgId) {
      setUploadMessage({ type: "error", message: "Organization context not loaded. Please refresh the page." });
      return;
    }

    setUploadLoading(true);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      if (selectedFile) formData.append("file", selectedFile);
      if (rawText.trim()) formData.append("raw_text", rawText);
      if (filename.trim()) formData.append("filename", filename);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(`${API_BASE}/api/kb/ingest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Organization-ID": orgId,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      const result: IngestResponse = await response.json();
      setUploadMessage({
        type: "success",
        message: `Document uploaded! ${result.chunks_ingested} chunks created, ${result.vectors_added} vectors added.`,
      });
      setSelectedFile(null);
      setRawText("");
      setFilename("");
      await loadStats();
    } catch (error) {
      setUploadMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      setUploadLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const hasRepAccess = user?.role === "rep" || user?.role === "admin";

  return (
    <PageShell>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Knowledge Base</h1>
            <p className="text-muted-foreground">Search and manage your knowledge base documents</p>
          </div>
          <BookOpen className="w-8 h-8 text-primary" />
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <m.div {...v.scaleIn}>
              <Card className="bg-surface border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                  <FileText className="h-4 w-4 text-muted" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.documents}</div>
                </CardContent>
              </Card>
            </m.div>

            <m.div {...v.scaleIn} transition={{ delay: 0.1 }}>
              <Card className="bg-surface border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Knowledge Chunks</CardTitle>
                  <Database className="h-4 w-4 text-muted" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.chunks}</div>
                </CardContent>
              </Card>
            </m.div>

            <m.div {...v.scaleIn} transition={{ delay: 0.2 }}>
              <Card className="bg-surface border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Search Ready</CardTitle>
                  <Search className="h-4 w-4 text-muted" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.documents > 0
                      ? <CheckCircle className="w-6 h-6 text-success" />
                      : <X className="w-6 h-6 text-danger" />}
                  </div>
                </CardContent>
              </Card>
            </m.div>
          </div>
        )}

        <Tabs
          defaultValue="search"
          className="space-y-6"
          onValueChange={(value) => {
            if (value === "manage" && hasRepAccess) loadDocuments();
          }}
        >
          <TabsList>
            <TabsTrigger value="search">Search Knowledge Base</TabsTrigger>
            {hasRepAccess && <TabsTrigger value="upload">Upload Documents</TabsTrigger>}
            {hasRepAccess && <TabsTrigger value="manage">Manage Documents</TabsTrigger>}
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-6">
            <m.div {...v.scaleIn}>
              <Card className="bg-surface border">
                <CardHeader>
                  <CardTitle>Search Documents</CardTitle>
                  <CardDescription>Search through your knowledge base to find relevant information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Input
                        placeholder="Enter your search query..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      />
                    </div>
                    <Button onClick={handleSearch} disabled={searchLoading || !searchQuery.trim()}>
                      {searchLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                      Search
                    </Button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Search Results</h3>
                      {searchResults.map((result) => (
                        <Card key={result.faiss_id}>
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start mb-2">
                              <Badge variant="secondary">
                                Score: {(result.score * 100).toFixed(1)}%
                              </Badge>
                              {result.document_id && (
                                <Badge variant="outline">Doc ID: {result.document_id}</Badge>
                              )}
                            </div>
                            {result.text_preview && (
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {result.text_preview}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {searchQuery && searchResults.length === 0 && !searchLoading && (
                    <div className="flex items-center gap-2 rounded-md border border-amber-800/50 bg-amber-950/20 p-3">
                      <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                      <p className="text-sm text-amber-300">
                        No results found for &quot;{searchQuery}&quot;. Try different keywords or check your spelling.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </m.div>
          </TabsContent>

          {/* Upload Tab */}
          {hasRepAccess && (
            <TabsContent value="upload" className="space-y-6">
              <m.div {...v.scaleIn}>
                <Card className="bg-surface border">
                  <CardHeader>
                    <CardTitle>Upload Documents</CardTitle>
                    <CardDescription>
                      Add new documents to your knowledge base. Supports text files, PDFs, and raw text input.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {uploadMessage && (
                      <div
                        className={`flex items-center gap-2 rounded-md border p-3 ${
                          uploadMessage.type === "error"
                            ? "border-red-800/50 bg-red-950/20"
                            : "border-green-800/50 bg-green-950/20"
                        }`}
                      >
                        {uploadMessage.type === "error"
                          ? <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                          : <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />}
                        <p className={`text-sm ${uploadMessage.type === "error" ? "text-red-300" : "text-green-300"}`}>
                          {uploadMessage.message}
                        </p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="file-upload">Upload File</Label>
                        <Input
                          id="file-upload"
                          type="file"
                          accept=".txt,.pdf,.doc,.docx,.md"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="raw-text">Or Enter Raw Text</Label>
                        <Textarea
                          id="raw-text"
                          placeholder="Paste your text content here..."
                          value={rawText}
                          onChange={(e) => setRawText(e.target.value)}
                          rows={6}
                          className="mt-1"
                        />
                      </div>

                      {rawText && (
                        <div>
                          <Label htmlFor="filename">Filename (for raw text)</Label>
                          <Input
                            id="filename"
                            placeholder="e.g., manual.txt"
                            value={filename}
                            onChange={(e) => setFilename(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      )}

                      <Button
                        onClick={handleFileUpload}
                        disabled={uploadLoading || (!selectedFile && !rawText.trim())}
                        className="w-full"
                      >
                        {uploadLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload to Knowledge Base
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </m.div>
            </TabsContent>
          )}

          {/* Access Denied */}
          {!hasRepAccess && (
            <TabsContent value="upload">
              <div className="flex items-center gap-2 rounded-md border border-amber-800/50 bg-amber-950/20 p-3">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                <p className="text-sm text-amber-300">
                  You need rep or admin access to upload documents to the knowledge base.
                </p>
              </div>
            </TabsContent>
          )}

          {/* Manage Tab */}
          {hasRepAccess && (
            <TabsContent value="manage" className="space-y-6">
              <m.div {...v.scaleIn}>
                <Card className="bg-surface border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Document Management
                    </CardTitle>
                    <CardDescription>View and manage knowledge base documents</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Filter documents by title..."
                        value={documentsFilter}
                        onChange={(e) => setDocumentsFilter(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={loadDocuments} disabled={documentsLoading} variant="outline">
                        {documentsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                      </Button>
                    </div>

                    {documentsLoading ? (
                      <div className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        <p className="text-sm text-muted-foreground mt-2">Loading documents...</p>
                      </div>
                    ) : documents.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground mt-2">No documents found</p>
                      </div>
                    ) : (
                      <div className="border rounded-lg">
                        <table className="w-full">
                          <thead className="border-b bg-muted/50">
                            <tr>
                              <th className="text-left p-3 font-medium">Title</th>
                              <th className="text-left p-3 font-medium">Type</th>
                              <th className="text-left p-3 font-medium">Chunks</th>
                              <th className="text-left p-3 font-medium">Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {documents
                              .filter((doc) =>
                                documentsFilter === "" ||
                                doc.title.toLowerCase().includes(documentsFilter.toLowerCase())
                              )
                              .map((doc) => (
                                <tr key={doc.id} className="border-b hover:bg-muted/25">
                                  <td className="p-3">
                                    <div className="font-medium">{doc.title}</div>
                                    <div className="text-xs text-muted-foreground">ID: {doc.id}</div>
                                  </td>
                                  <td className="p-3">
                                    <Badge variant="outline">{doc.source_type}</Badge>
                                  </td>
                                  <td className="p-3 text-center">
                                    <Badge variant="secondary">{doc.chunk_count}</Badge>
                                  </td>
                                  <td className="p-3 text-sm text-muted-foreground">
                                    {new Date(doc.created_at).toLocaleDateString()}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </m.div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </PageShell>
  );
}
