(() => {
  const K_FACTOR = 24;

  function safeElo(value) {
    const elo = Number(value);
    return Number.isFinite(elo) ? Math.max(0, Math.round(elo)) : null;
  }

  function validPlayers(players) {
    if (!Array.isArray(players) || players.length < 2) return false;
    const ids = new Set();
    return players.every((player) => {
      const id = String(player?.id || '');
      const placement = Number(player?.placement);
      if (!id || ids.has(id) || safeElo(player?.elo) === null || !Number.isInteger(placement) || placement < 1) return false;
      ids.add(id);
      return true;
    });
  }

  function expectedScore(elo, opponentElo) {
    return 1 / (1 + (10 ** ((opponentElo - elo) / 400)));
  }

  function actualScore(placement, opponentPlacement) {
    if (placement < opponentPlacement) return 1;
    if (placement > opponentPlacement) return 0;
    return 0.5;
  }

  function calculate(players) {
    if (!validPlayers(players)) return [];
    const normalized = players.map((player) => ({
      id: String(player.id),
      elo: safeElo(player.elo),
      placement: player.placement
    }));
    const opponentCount = normalized.length - 1;

    return normalized.map((player) => {
      const totalDifference = normalized.reduce((total, opponent) => {
        if (opponent.id === player.id) return total;
        return total + actualScore(player.placement, opponent.placement) - expectedScore(player.elo, opponent.elo);
      }, 0);
      const rawChange = Math.round(K_FACTOR * (totalDifference / opponentCount));
      const newElo = Math.max(0, player.elo + rawChange);
      return { id: player.id, oldElo: player.elo, newElo, change: newElo - player.elo };
    });
  }

  window.FlagQuizElo = { K_FACTOR, calculate };
})();
