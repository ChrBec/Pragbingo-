import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useEvent } from "../state/EventContext";
import { ListEditor } from "../components/ListEditor";
import {
  DEFAULT_BINGO_TASKS,
  DEFAULT_CHAOS_POOL,
  DEFAULT_MISSION_POOL,
  DEFAULT_MOMENT_TAGS,
  DEFAULT_VOTING_CATEGORIES,
} from "../data/defaults";

export function CreateEvent() {
  const { createEvent } = useEvent();
  const navigate = useNavigate();

  const [name, setName] = useState("JGA in Prag");
  const [groomName, setGroomName] = useState("");
  const [hostName, setHostName] = useState("");
  const [bingoTasks, setBingoTasks] = useState<string[]>(DEFAULT_BINGO_TASKS);
  const [missionPool, setMissionPool] = useState<string[]>(DEFAULT_MISSION_POOL);
  const [chaosPool, setChaosPool] = useState<string[]>(DEFAULT_CHAOS_POOL);
  const [momentTags, setMomentTags] = useState<string[]>(DEFAULT_MOMENT_TAGS);
  const [votingCategories, setVotingCategories] = useState<string[]>(
    DEFAULT_VOTING_CATEGORIES,
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bingoValid = bingoTasks.length === 25 && bingoTasks.every((t) => t.trim());
  const canSubmit =
    groomName.trim() &&
    hostName.trim() &&
    name.trim() &&
    bingoValid &&
    missionPool.filter((m) => m.trim()).length >= 3 &&
    chaosPool.filter((c) => c.trim()).length >= 1;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const code = await createEvent({
        name: name.trim(),
        groomName: groomName.trim(),
        hostName: hostName.trim(),
        bingoTasks: bingoTasks.map((t) => t.trim()),
        missionPool: missionPool.map((m) => m.trim()).filter(Boolean),
        chaosPool: chaosPool.map((c) => c.trim()).filter(Boolean),
        momentTags: momentTags.map((m) => m.trim()).filter(Boolean),
        votingCategories: votingCategories.map((v) => v.trim()).filter(Boolean),
      });
      void code;
      navigate("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Etwas ist schiefgelaufen.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen">
      <Link to="/" className="back-link">
        ← Zurück
      </Link>
      <h1>Event erstellen</h1>
      <p className="muted">
        Als Gastgeber:in legst du das Event an und bekommst einen Code, den du
        an alle Gäste verteilst.
      </p>

      <label className="field">
        <span>Event-Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Name des Bräutigams</span>
        <input
          value={groomName}
          onChange={(e) => setGroomName(e.target.value)}
          placeholder="z.B. Max"
        />
      </label>
      <label className="field">
        <span>Dein Name (Gastgeber:in)</span>
        <input
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
          placeholder="z.B. Tom"
        />
      </label>

      <button
        type="button"
        className="ghost-btn"
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? "Erweiterte Optionen ausblenden" : "Missionen, Bingo & Co. anpassen ▾"}
      </button>

      {showAdvanced && (
        <div className="advanced-panel">
          <ListEditor
            label="JGA-Bingo (genau 25 Felder)"
            items={bingoTasks}
            onChange={setBingoTasks}
            minItems={25}
            maxItems={25}
          />
          <ListEditor
            label="Geheime Missionen"
            items={missionPool}
            onChange={setMissionPool}
            minItems={3}
          />
          <ListEditor
            label="Chaos-Knopf Aufgaben"
            items={chaosPool}
            onChange={setChaosPool}
            minItems={1}
          />
          <ListEditor
            label="Momente zum Markieren"
            items={momentTags}
            onChange={setMomentTags}
            minItems={1}
          />
          <ListEditor
            label="Abstimmungs-Kategorien"
            items={votingCategories}
            onChange={setVotingCategories}
            minItems={1}
          />
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      <button
        className="primary-btn"
        disabled={!canSubmit || submitting}
        onClick={handleSubmit}
      >
        {submitting ? "Wird erstellt…" : "Event erstellen 🎉"}
      </button>
      {!bingoValid && (
        <p className="hint">Das Bingo-Feld braucht genau 25 ausgefüllte Einträge.</p>
      )}
    </div>
  );
}
