interface ListEditorProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  minItems?: number;
  maxItems?: number;
  placeholder?: string;
}

export function ListEditor({
  label,
  items,
  onChange,
  minItems = 1,
  maxItems,
  placeholder,
}: ListEditorProps) {
  const updateItem = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next);
  };

  const removeItem = (index: number) => {
    if (items.length <= minItems) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    if (maxItems && items.length >= maxItems) return;
    onChange([...items, ""]);
  };

  return (
    <div className="list-editor">
      <div className="list-editor-header">
        <span>{label}</span>
        <span className="list-editor-count">
          {items.length}
          {maxItems ? ` / ${maxItems}` : ""}
        </span>
      </div>
      <div className="list-editor-items">
        {items.map((item, i) => (
          <div className="list-editor-row" key={i}>
            <span className="list-editor-index">{i + 1}</span>
            <input
              value={item}
              placeholder={placeholder}
              onChange={(e) => updateItem(i, e.target.value)}
            />
            <button
              type="button"
              className="icon-btn danger"
              onClick={() => removeItem(i)}
              disabled={items.length <= minItems}
              aria-label="Entfernen"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      {(!maxItems || items.length < maxItems) && (
        <button type="button" className="ghost-btn" onClick={addItem}>
          + Eintrag hinzufügen
        </button>
      )}
    </div>
  );
}
