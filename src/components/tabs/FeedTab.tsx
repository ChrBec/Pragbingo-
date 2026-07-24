import { useRef, useState } from "react";
import { useEvent } from "../../state/EventContext";

function timeAgo(ts: number): string {
  const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  return `vor ${diffH} h`;
}

export function FeedTab() {
  const { feed, uploadFeedPost } = useEvent();
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      await uploadFeedPost(file, caption);
      setShowUpload(false);
      setFile(null);
      setCaption("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tab-screen">
      <div className="tab-header-row">
        <h2>Foto-Feed 📸</h2>
        <button className="primary-btn small" onClick={() => setShowUpload(true)}>
          + Teilen
        </button>
      </div>
      <p className="muted">Alle Erinnerungen des Abends an einem Ort.</p>

      <div className="feed-list">
        {feed.length === 0 && <p className="muted">Noch keine Beiträge – sei die/der Erste!</p>}
        {feed.map((post) => (
          <div className="feed-card" key={post.id}>
            {post.type === "photo" ? (
              <img src={post.url} alt={post.caption || post.missionText || "Foto"} />
            ) : (
              <video src={post.url} controls />
            )}
            <div className="feed-card-body">
              <div className="feed-card-meta">
                <strong>{post.playerName}</strong>
                <span className="muted">· {timeAgo(post.createdAt)}</span>
              </div>
              {post.missionText && (
                <div className="feed-mission-tag">🎯 {post.missionText}</div>
              )}
              {post.caption && <div className="feed-caption">{post.caption}</div>}
            </div>
          </div>
        ))}
      </div>

      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Moment teilen</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <input
              className="caption-input"
              placeholder="Kurzer Kommentar (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => setShowUpload(false)}>
                Abbrechen
              </button>
              <button className="primary-btn" disabled={!file || submitting} onClick={submit}>
                {submitting ? "Lädt hoch…" : "Posten 🚀"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
