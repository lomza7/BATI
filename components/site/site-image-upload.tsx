'use client';

import { useState, useRef } from 'react';
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface SiteImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  aspectRatio?: string;
  className?: string;
}

export function SiteImageUpload({
  value,
  onChange,
  label = 'Glissez une image ou cliquez',
  hint = 'JPG, PNG, WebP — 5 Mo max',
  aspectRatio = 'aspect-[16/9]',
  className = '',
}: SiteImageUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!user) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;

    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from('site-assets')
      .upload(fileName, file, { contentType: file.type, upsert: false });

    if (!error) {
      const { data: urlData } = supabase.storage
        .from('site-assets')
        .getPublicUrl(fileName);
      onChange(urlData.publicUrl);
    }
    setUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  }

  if (value) {
    return (
      <div className={`relative ${aspectRatio} bg-muted/30 overflow-hidden rounded-lg group ${className}`}>
        <img src={value} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-9 px-3 rounded-lg bg-white/90 text-foreground text-xs font-medium flex items-center gap-1.5 hover:bg-white transition-all shadow-lg"
          >
            <Upload className="h-3.5 w-3.5" /> Changer
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="h-9 w-9 rounded-lg bg-white/90 text-red-600 flex items-center justify-center hover:bg-white transition-all shadow-lg"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative ${aspectRatio} rounded-lg overflow-hidden cursor-pointer transition-all border-2 border-dashed ${
        dragOver ? 'bg-primary/5 border-primary' : 'bg-muted/10 border-border hover:border-primary/40'
      } ${className}`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground">Upload en cours...</span>
          </>
        ) : (
          <>
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${dragOver ? 'bg-primary/10' : 'bg-muted/50'}`}>
              <ImagePlus className={`h-5 w-5 ${dragOver ? 'text-primary' : 'text-muted-foreground/50'}`} />
            </div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-[10px] text-muted-foreground/50">{hint}</p>
          </>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
}
