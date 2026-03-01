/**
 * telemetry.ts (route)
 *
 * REST API endpoints for querying telemetry data.
 */

import express, { Request, Response } from 'express';
import { getRecentEvents, getStats } from '../services/telemetry.js';
import type { TelemetryCategory } from '../types/telemetryEvents.js';

const router = express.Router();

/**
 * GET /api/telemetry/events?category=llm&sessionId=xxx&limit=100
 * Returns recent telemetry events from the in-memory ring buffer.
 */
router.get('/events', (req: Request, res: Response): void => {
    const category = typeof req.query.category === 'string'
        ? req.query.category as TelemetryCategory
        : undefined;
    const sessionId = typeof req.query.sessionId === 'string'
        ? req.query.sessionId
        : undefined;
    const limit = typeof req.query.limit === 'string'
        ? Math.max(1, Math.min(1000, parseInt(req.query.limit, 10) || 100))
        : 100;

    const events = getRecentEvents({ category, sessionId, limit });
    res.json({ count: events.length, events });
});

/**
 * GET /api/telemetry/stats
 * Returns aggregate telemetry statistics.
 */
router.get('/stats', (_req: Request, res: Response): void => {
    res.json(getStats());
});

/**
 * GET /api/telemetry/sessions/:id
 * Returns all recent events for a specific session.
 */
router.get('/sessions/:id', (req: Request, res: Response): void => {
    const sessionId = req.params.id;
    const events = getRecentEvents({ sessionId, limit: 500 });
    res.json({ sessionId, count: events.length, events });
});

export { router as telemetryRouter };
