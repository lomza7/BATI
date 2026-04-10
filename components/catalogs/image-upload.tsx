'use client';

import { useState, useRef } from 'react';
import { ImagePlus, Loader as Loader2, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface Props {
  value: string;
  onChange: (url: string) => void;
  aspectRatio?: string;
}

export function ImageUpload({ value, onChange, aspectRatio = 'aspect-[4/3]' }: Props) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!user) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return;

    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from('catalog-images')
      .upload(fileName, file, { contentType: file.type, upsert: false });

    if (!error) {
      const { data: urlData } = supabase.storage
        .from('catalog-images')
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

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
  }

  if (value) {
    return (
      <div className={`relative ${aspectRatio} bg-muted/30 overflow-hidden rounded-t-xl group`}>
        <img
          src={value}
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            onClick={() => inputRef.current?.click()}
            className="h-9 px-3 rounded-lg bg-white/90 text-foreground text-xs font-medium flex items-center gap-1.5 hover:bg-white transition-all shadow-lg"
          >
            <Upload className="h-3.5 w-3.5" />
            Changer
          </button>
          <button
            onClick={handleRemove}
            className="h-9 w-9 rounded-lg bg-white/90 text-destructive flex items-center justify-center hover:bg-white transition-all shadow-lg"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative ${aspectRatio} rounded-t-xl overflow-hidden cursor-pointer transition-all ${
        dragOver
          ? 'bg-primary/5 border-2 border-dashed border-primary'
          : 'bg-muted/20 hover:bg-muted/30'
      }`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground">Upload en cours...</span>
          </>
        ) : (
          <>
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all ${
              dragOver ? 'bg-primary/10 scale-110' : 'bg-muted/50'
            }`}>
              <ImagePlus className={`h-6 w-6 ${dragOver ? 'text-primary' : 'text-muted-foreground/40'}`} />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-muted-foreground">
                {dragOver ? 'Déposez ici' : 'Glissez une image ou cliquez'}
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                JPG, PNG, WebP — 10 Mo max
              </p>
            </div>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
