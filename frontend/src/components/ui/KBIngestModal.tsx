'use client';

import { cn } from '@/lib/utils';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Textarea } from './textarea';
import { Badge } from './badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import {
  Upload,
  FileText,
  Globe,
  MessageSquare,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { forwardRef, useState, useCallback } from 'react';

interface IngestSource {
  id: string;
  type: 'file' | 'url' | 'text';
  name: string;
  content?: string;
  url?: string;
  file?: File;
  size?: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}

interface KBIngestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIngest?: (sources: IngestSource[]) => void;
  maxSources?: number;
  maxFileSize?: number; // in MB
  supportedFileTypes?: string[];
  className?: string;
}

const KBIngestModal = forwardRef<HTMLDivElement, KBIngestModalProps>(
  (
    {
      open,
      onOpenChange,
      onIngest,
      maxSources = 10,
      maxFileSize = 10,
      supportedFileTypes = ['.txt', '.md', '.pdf', '.docx'],
      className,
      ...props
    },
    ref
  ) => {
    const [sources, setSources] = useState<IngestSource[]>([]);
    const [activeTab, setActiveTab] = useState<'file' | 'url' | 'text'>('file');
    const [isProcessing, setIsProcessing] = useState(false);

    // Form states for each type
    const [urlInput, setUrlInput] = useState('');
    const [textInput, setTextInput] = useState('');
    const [textTitle, setTextTitle] = useState('');

    const generateId = () => Math.random().toString(36).substr(2, 9);

    const addFileSource = useCallback(
      (files: FileList | null) => {
        if (!files) return;

        const newSources: IngestSource[] = [];

        for (
          let i = 0;
          i < files.length && sources.length + newSources.length < maxSources;
          i++
        ) {
          const file = files[i];
          const fileSizeMB = file.size / (1024 * 1024);

          if (fileSizeMB > maxFileSize) {
            continue; // Skip files that are too large
          }

          const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
          if (!supportedFileTypes.includes(fileExtension)) {
            continue; // Skip unsupported file types
          }

          newSources.push({
            id: generateId(),
            type: 'file',
            name: file.name,
            file,
            size: file.size,
            status: 'pending',
          });
        }

        setSources(prev => [...prev, ...newSources]);
      },
      [sources.length, maxSources, maxFileSize, supportedFileTypes]
    );

    const addUrlSource = () => {
      if (!urlInput.trim()) return;

      const newSource: IngestSource = {
        id: generateId(),
        type: 'url',
        name: urlInput,
        url: urlInput.trim(),
        status: 'pending',
      };

      setSources(prev => [...prev, newSource]);
      setUrlInput('');
    };

    const addTextSource = () => {
      if (!textInput.trim() || !textTitle.trim()) return;

      const newSource: IngestSource = {
        id: generateId(),
        type: 'text',
        name: textTitle.trim(),
        content: textInput.trim(),
        size: new Blob([textInput]).size,
        status: 'pending',
      };

      setSources(prev => [...prev, newSource]);
      setTextInput('');
      setTextTitle('');
    };

    const removeSource = (id: string) => {
      setSources(prev => prev.filter(source => source.id !== id));
    };

    const handleIngest = async () => {
      if (sources.length === 0) return;

      setIsProcessing(true);

      // Simulate processing
      for (let i = 0; i < sources.length; i++) {
        setSources(prev =>
          prev.map((source, index) =>
            index === i ? { ...source, status: 'processing' } : source
          )
        );

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000));

        setSources(prev =>
          prev.map((source, index) =>
            index === i ? { ...source, status: 'completed' } : source
          )
        );
      }

      setIsProcessing(false);
      onIngest?.(sources);

      // Reset after successful ingest
      setTimeout(() => {
        setSources([]);
        onOpenChange(false);
      }, 1500);
    };

    const formatFileSize = (bytes: number) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getStatusIcon = (status: IngestSource['status']) => {
      switch (status) {
        case 'pending':
          return <Clock className="h-4 w-4 text-yellow-500" />;
        case 'processing':
          return <Zap className="h-4 w-4 text-blue-500 animate-pulse" />;
        case 'completed':
          return <CheckCircle className="h-4 w-4 text-green-500" />;
        case 'error':
          return <AlertCircle className="h-4 w-4 text-red-500" />;
        default:
          return null;
      }
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          ref={ref}
          className={cn(
            'max-w-4xl max-h-[80vh] overflow-hidden flex flex-col',
            className
          )}
          {...props}
        >
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
            <DialogDescription>
              Upload files, URLs, or text content to your knowledge base. Max{' '}
              {maxSources} sources, {maxFileSize}MB per file.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-6">
            {/* Source Type Tabs */}
            <div className="flex space-x-1 bg-muted/50 p-1 rounded-lg">
              {[
                { id: 'file', label: 'Files', icon: FileText },
                { id: 'url', label: 'URLs', icon: Globe },
                { id: 'text', label: 'Text', icon: MessageSquare },
              ].map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  variant={activeTab === id ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab(id as typeof activeTab)}
                  className="flex-1 text-xs"
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {label}
                </Button>
              ))}
            </div>

            {/* Input Section */}
            <div className="space-y-4">
              {activeTab === 'file' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Upload Files</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Supported formats: {supportedFileTypes.join(', ')}
                    </p>
                    <Input
                      type="file"
                      multiple
                      accept={supportedFileTypes.join(',')}
                      onChange={e => addFileSource(e.target.files)}
                      className="w-full max-w-sm mx-auto"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'url' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com/article"
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addUrlSource()}
                    />
                    <Button onClick={addUrlSource} disabled={!urlInput.trim()}>
                      Add URL
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'text' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="text-title">Title</Label>
                    <Input
                      id="text-title"
                      placeholder="Content title..."
                      value={textTitle}
                      onChange={e => setTextTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="text-content">Content</Label>
                    <Textarea
                      id="text-content"
                      placeholder="Paste your content here..."
                      value={textInput}
                      onChange={e => setTextInput(e.target.value)}
                      rows={6}
                    />
                  </div>
                  <Button
                    onClick={addTextSource}
                    disabled={!textInput.trim() || !textTitle.trim()}
                    className="w-full"
                  >
                    Add Text Content
                  </Button>
                </div>
              )}
            </div>

            {/* Sources List */}
            {sources.length > 0 && (
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">
                    Sources ({sources.length}/{maxSources})
                  </h4>
                  <Badge variant="outline">
                    Total:{' '}
                    {formatFileSize(
                      sources.reduce((sum, s) => sum + (s.size || 0), 0)
                    )}
                  </Badge>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {sources.map(source => (
                    <div
                      key={source.id}
                      className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getStatusIcon(source.status)}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {source.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {source.type}
                            </Badge>
                            {source.size && (
                              <span>{formatFileSize(source.size)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {source.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSource(source.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleIngest}
              disabled={sources.length === 0 || isProcessing}
              className="min-w-24"
            >
              {isProcessing ? (
                <>
                  <Zap className="h-4 w-4 mr-2 animate-pulse" />
                  Processing...
                </>
              ) : (
                `Upload ${sources.length} Document${sources.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
KBIngestModal.displayName = 'KBIngestModal';

export { KBIngestModal, type IngestSource };
