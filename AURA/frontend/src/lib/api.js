import { apiClient } from '@/config';

// Tournaments API
export const tournamentsApi = {
  // GET /tournaments - Get all tournaments with filtering
  getAll: (params = {}) => {
    return apiClient.get('/tournaments', { params });
  },

  // GET /tournaments/:id - Get individual tournament details
  getById: (id, mini = false) => {
    const params = mini ? { mini: 'true' } : {};
    return apiClient.get(`/tournaments/${id}`, { params });
  },

  // GET /tournaments/:id/rounds - Get tournament rounds from metadata
  getRounds: (id) => {
    return apiClient.get(`/tournaments/${id}/rounds`);
  },

  // GET /tournaments/:id/:round - Get tournament round details
  getRound: (id, round) => {
    return apiClient.get(`/tournaments/${id}/${round}`);
  },

  // POST /tournaments/:id/join - Join as referee
  joinAsReferee: (id) => {
    return apiClient.post(`/tournaments/${id}/join`);
  },

  // GET /tournaments/:id/:round/:match - Get match details
  getMatch: (id, round, match) => {
    return apiClient.get(`/tournaments/${id}/${round}/${match}`);
  },

  // GET /tournaments/referee/:id/:round/:match - Get referee match details
  getRefereeMatch: (id, round, match) => {
    return apiClient.get(`/tournaments/referee/${id}/${round}/${match}`);
  },

  // POST /tournaments/referee/:id/:round/:match - Update referee match score
  updateRefereeMatch: (id, round, match, data) => {
    return apiClient.post(`/tournaments/referee/${id}/${round}/${match}`, data);
  },

  // POST /tournaments - Create a new tournament
  create: (data) => {
    return apiClient.post('/tournaments', data);
  },

  // POST /tournaments/:id/register - Register for a tournament
  register: (id) => {
    return apiClient.post(`/tournaments/${id}/register`, {});
  },

  // GET /tournaments/hosted - Get tournaments hosted by current player
  getHosted: () => {
    return apiClient.get("/tournaments/hosted");
  },

  // GET /tournaments/referee - Get tournaments where current player is a referee
  getReferee: () => {
    return apiClient.get("/tournaments/referee");
  },

  // GET /tournaments/registered - Get tournaments where current player is registered
  getRegistered: () => {
    return apiClient.get("/tournaments/registered");
  },

  // POST /tournaments/:id/referees - Add a referee to a tournament
  addReferee: (id, playerId) => {
    return apiClient.post(`/tournaments/${id}/referees`, {
      player_id: playerId,
    });
  },

  // DELETE /tournaments/:id/referees/:playerId - Remove a referee from a tournament
  removeReferee: (id, playerId) => {
    return apiClient.delete(`/tournaments/${id}/referees/${playerId}`);
  },

  // GET /tournaments/:id/round-status - Get current round status
  getRoundStatus: (id) => {
    return apiClient.get(`/tournaments/${id}/round-status`);
  },

  // GET /tournaments/:id/current-round-matches - Get matches for current round
  getCurrentRoundMatches: (id) => {
    return apiClient.get(`/tournaments/${id}/current-round-matches`);
  },
};

// Matches API
export const matchesApi = {
  // PUT /matches/:id - Update match
  update: (id, data) => {
    return apiClient.put(`/matches/${id}`, data);
  },

  // POST /matches/:id/start - Start a match with positions
  start: (id, data) => {
    return apiClient.post(`/matches/${id}/start`, data);
  },

  // GET /matches/:id/state - Get current match state
  getState: (id) => {
    return apiClient.get(`/matches/${id}/state`);
  },

  // POST /matches/:id/point - Record a point
  recordPoint: (id, data) => {
    return apiClient.post(`/matches/${id}/point`, data);
  },

  // POST /matches/:id/undo - Undo last point
  undo: (id) => {
    return apiClient.post(`/matches/${id}/undo`, {});
  },

  // GET /matches/referee - Get matches assigned to current user as referee
  getRefereeMatches: () => {
    return apiClient.get("/matches/referee");
  },
};

// Pairings API
export const pairingsApi = {
  // POST /pairings/generate-round - Generate pairings for the next round
  generateRound: (tournamentId) => {
    return apiClient.post("/pairings/generate-round", {
      tournamentId,
    });
  },
};

// Players API
export const playersApi = {
  // GET /players/search?q=query - Search players by username
  search: (query) => {
    return apiClient.get("/players/search", { params: { q: query } });
  },
};

// User API
export const userApi = {
  // GET /user/details - Get comprehensive user details
  getDetails: () => {
    return apiClient.get('/user/details');
  },
};

// Venues API
export const venuesApi = {
  // GET /venues - Get all venues
  getAll: () => {
    return apiClient.get('/venues');
  },
};

// Match Formats API
export const matchFormatsApi = {
  // GET /match-formats - Get all match formats
  getAll: () => {
    return apiClient.get('/match-formats');
  },
};

