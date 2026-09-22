/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { findGameInApi, parseGameFromHtml, extractGameInfo, ChessComApiResponse } from './game-source';

describe('Game Source', () => {
  describe('findGameInApi', () => {
    it('should find game by exact url match', () => {
      const apiRes: ChessComApiResponse = {
        games: [
          { url: 'https://www.chess.com/game/live/123', pgn: '[Event "Live Chess"]\n1. e4 e5' },
          { url: 'https://www.chess.com/game/live/456', pgn: '[Event "Live Chess"]\n1. d4 d5' }
        ]
      };
      
      const pgn = findGameInApi(apiRes, 'https://www.chess.com/game/live/456');
      expect(pgn).toBe('[Event "Live Chess"]\n1. d4 d5');
    });

    it('should find game by url match ignoring query params and protocol', () => {
      const apiRes: ChessComApiResponse = {
        games: [
          { url: 'https://www.chess.com/game/live/123', pgn: '[Event "Live Chess"]' }
        ]
      };
      
      const pgn = findGameInApi(apiRes, 'http://www.chess.com/game/live/123?foo=bar');
      expect(pgn).toBe('[Event "Live Chess"]');
    });
    
    it('should return null if API response is invalid or empty', () => {
      expect(findGameInApi(null as any, 'url')).toBeNull();
      expect(findGameInApi({} as any, 'url')).toBeNull();
      expect(findGameInApi({ games: [] }, 'url')).toBeNull();
    });
  });

  describe('parseGameFromHtml', () => {
    it('should find PGN in a textarea', () => {
      document.body.innerHTML = `
        <textarea name="pgn">[Event "Live Chess"]
1. e4 e5</textarea>
      `;
      expect(parseGameFromHtml(document)).toBe('[Event "Live Chess"]\n1. e4 e5');
    });

    it('should find PGN in a script tag as JSON', () => {
      document.body.innerHTML = `
        <script>
          window.__INITIAL_STATE__ = {
            "game": {
              "pgn": "[Event \\"Live Chess\\"]\\n1. e4 e5"
            }
          };
        </script>
      `;
      expect(parseGameFromHtml(document)).toBe('[Event "Live Chess"]\n1. e4 e5');
    });

    it('should return null if PGN is not found', () => {
      document.body.innerHTML = '<div>No game here</div>';
      expect(parseGameFromHtml(document)).toBeNull();
    });
  });

  describe('extractGameInfo', () => {
    it('should extract player names and date parts', () => {
      document.body.innerHTML = `
        <div class="user-tagline-username">player1</div>
        <div data-test-element="user-tagline-username">player2</div>
      `;
      const info = extractGameInfo(document, 'https://chess.com/game');
      
      expect(info.url).toBe('https://chess.com/game');
      expect(info.players).toContain('player1');
      expect(info.players).toContain('player2');
      expect(info.currentYear).toMatch(/^202[0-9]$/);
      expect(info.currentMonth).toMatch(/^[0-1][0-9]$/);
    });
  });
});
