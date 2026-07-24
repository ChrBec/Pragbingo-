import { useMemo } from "react";
import { useEvent } from "../../state/EventContext";

export function ReportTab() {
  const { event, players, feed, ballots, log } = useEvent();

  const stats = useMemo(() => {
    const approvedPlayers = players.filter((p) => p.approved);
    const ranked = [...approvedPlayers].sort((a, b) => b.points - a.points);

    const votingWinners = (event?.votingCategories ?? []).map((category) => {
      const tally = new Map<string, number>();
      for (const b of ballots) {
        if (b.category !== category) continue;
        tally.set(b.postId, (tally.get(b.postId) ?? 0) + 1);
      }
      let bestPostId: string | null = null;
      let bestCount = 0;
      for (const [postId, count] of tally) {
        if (count > bestCount) {
          bestCount = count;
          bestPostId = postId;
        }
      }
      const post = feed.find((f) => f.id === bestPostId);
      return { category, post, votes: bestCount };
    });

    const bingoChampions = approvedPlayers.filter((p) =>
      p.bingoBonusAwarded.includes("full"),
    );

    const missionCounts = approvedPlayers
      .map((p) => ({
        player: p,
        done: p.missions.filter((m) => m.status === "done").length,
      }))
      .sort((a, b) => b.done - a.done);

    const momentByTagAndPlayer = new Map<string, Map<string, number>>();
    for (const entry of log) {
      if (entry.type !== "moment_tag" || !entry.aboutPlayerName) continue;
      const perTag = momentByTagAndPlayer.get(entry.note) ?? new Map();
      perTag.set(
        entry.aboutPlayerName,
        (perTag.get(entry.aboutPlayerName) ?? 0) + 1,
      );
      momentByTagAndPlayer.set(entry.note, perTag);
    }
    const momentHighlights: Array<{ tag: string; player: string; count: number }> = [];
    for (const [tag, perPlayer] of momentByTagAndPlayer) {
      let bestPlayer = "";
      let bestCount = 0;
      for (const [player, count] of perPlayer) {
        if (count > bestCount) {
          bestCount = count;
          bestPlayer = player;
        }
      }
      if (bestPlayer) momentHighlights.push({ tag, player: bestPlayer, count: bestCount });
    }

    const chaosDone = log.filter((l) => l.type === "chaos_done").length;

    return { ranked, votingWinners, bingoChampions, missionCounts, momentHighlights, chaosDone };
  }, [players, feed, ballots, log, event]);

  if (!event) return null;

  return (
    <div className="tab-screen">
      <h2>Abschlussbericht 📋</h2>
      <p className="muted">Automatisch erzeugte Zusammenfassung von {event.name}.</p>

      <div className="panel highlight-panel">
        <h3>🏆 Gesamtsieger</h3>
        {stats.ranked.slice(0, 3).map((p, i) => (
          <div className="report-row" key={p.id}>
            <span>{["🥇", "🥈", "🥉"][i]}</span>
            <span>{p.name}</span>
            <span className="muted">{p.points} P</span>
          </div>
        ))}
      </div>

      {stats.bingoChampions.length > 0 && (
        <div className="panel">
          <h3>🎯 Bingo-Champions</h3>
          <p>{stats.bingoChampions.map((p) => p.name).join(", ")}</p>
        </div>
      )}

      <div className="panel">
        <h3>🕵️ Missionen-Meister</h3>
        {stats.missionCounts.slice(0, 3).map(({ player, done }) => (
          <div className="report-row" key={player.id}>
            <span>{player.name}</span>
            <span className="muted">{done} erledigt</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>🗳️ Abstimmungssieger</h3>
        {stats.votingWinners.map(({ category, post, votes }) => (
          <div className="report-row" key={category}>
            <span>{category}</span>
            <span className="muted">
              {post ? `${post.playerName} (${votes} Stimmen)` : "keine Stimmen"}
            </span>
          </div>
        ))}
      </div>

      {stats.momentHighlights.length > 0 && (
        <div className="panel">
          <h3>📊 Kuriose Statistiken</h3>
          {stats.momentHighlights.map((h) => (
            <div className="report-row" key={h.tag}>
              <span>Häufigst: „{h.tag}“</span>
              <span className="muted">{h.player} ({h.count}x)</span>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <h3>🎲 Chaos-Knopf</h3>
        <p>{stats.chaosDone} Aufgaben erfolgreich gemeistert.</p>
      </div>

      <div className="panel">
        <h3>📸 Foto-Highlights</h3>
        <div className="report-photo-grid">
          {feed.slice(0, 6).map((post) =>
            post.type === "photo" ? (
              <img key={post.id} src={post.url} alt={post.caption} />
            ) : (
              <video key={post.id} src={post.url} muted />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
