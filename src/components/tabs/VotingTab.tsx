import { useState } from "react";
import { useEvent } from "../../state/EventContext";

export function VotingTab() {
  const { event, feed, ballots, castVote, currentPlayer } = useEvent();
  const [activeCategory, setActiveCategory] = useState<string | null>(
    event?.votingCategories[0] ?? null,
  );

  if (!event || !currentPlayer) return null;

  const category = activeCategory ?? event.votingCategories[0] ?? "";
  const myBallot = ballots.find(
    (b) => b.category === category && b.playerId === currentPlayer.id,
  );
  const tally = new Map<string, number>();
  for (const b of ballots) {
    if (b.category !== category) continue;
    tally.set(b.postId, (tally.get(b.postId) ?? 0) + 1);
  }

  return (
    <div className="tab-screen">
      <h2>Abstimmungen 🗳️</h2>
      <p className="muted">Stimmt live für die besten Momente des Abends.</p>

      <div className="category-tabs">
        {event.votingCategories.map((c) => (
          <button
            key={c}
            className={"category-tab" + (c === category ? " active" : "")}
            onClick={() => setActiveCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {feed.length === 0 && (
        <p className="muted">Es gibt noch keine Fotos/Videos im Feed zum Abstimmen.</p>
      )}

      <div className="vote-grid">
        {feed.map((post) => {
          const votes = tally.get(post.id) ?? 0;
          const isMyVote = myBallot?.postId === post.id;
          return (
            <div className={"vote-card" + (isMyVote ? " voted" : "")} key={post.id}>
              {post.type === "photo" ? (
                <img src={post.url} alt={post.caption} />
              ) : (
                <video src={post.url} controls />
              )}
              <div className="vote-card-footer">
                <span className="muted small">{post.playerName}</span>
                <button
                  className={isMyVote ? "primary-btn small" : "ghost-btn small"}
                  onClick={() => castVote(category, post.id)}
                >
                  {isMyVote ? "✓ Deine Stimme" : "Abstimmen"}
                </button>
                <span className="vote-count">{votes} Stimme{votes === 1 ? "" : "n"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
