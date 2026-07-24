import { useRef } from "react";

interface MediaCaptureInputProps {
  file: File | null;
  onChange: (file: File | null) => void;
}

export function MediaCaptureInput({ file, onChange }: MediaCaptureInputProps) {
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  return (
    <div className="media-capture">
      <div className="media-capture-buttons">
        <button
          type="button"
          className="ghost-btn small"
          onClick={() => photoRef.current?.click()}
        >
          📷 Foto aufnehmen
        </button>
        <button
          type="button"
          className="ghost-btn small"
          onClick={() => videoRef.current?.click()}
        >
          🎥 Video aufnehmen
        </button>
        <button
          type="button"
          className="ghost-btn small"
          onClick={() => galleryRef.current?.click()}
        >
          🖼️ Aus Galerie wählen
        </button>
      </div>

      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        capture="environment"
        hidden
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />

      {file && <p className="muted small media-capture-selected">Ausgewählt: {file.name}</p>}
    </div>
  );
}
