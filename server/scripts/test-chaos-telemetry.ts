import { WebSocket } from 'ws';

const WS_URL = 'ws://localhost:8787';

async function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runChaosTest() {
    console.log('--- STARTING CHAOS TELEMETRY TEST ---');

    const ws = new WebSocket(WS_URL);

    ws.on('open', async () => {
        console.log('[test] Connected to server.');

        // 1. Send empty ANALYZE payload
        console.log('[test] Sending empty ANALYZE payload...');
        ws.send(JSON.stringify({
            type: 'ANALYZE',
            payload: {}
        }));
        await wait(1000);

        // 2. Send malformed telemetry (multiple to test sampling)
        console.log('[test] Sending 15 telemetry updates...');
        for (let i = 0; i < 15; i++) {
            ws.send(JSON.stringify({
                type: 'telemetry',
                payload: {
                    hp: 10,
                    bossHP: 50,
                    bossActive: true,
                    accuracy: 0.5,
                    totalDashCount: i
                }
            }));
            await wait(100);
        }

        // 3. Send corrupt AI_ASSISTANT_QUERY
        console.log('[test] Sending corrupt AI_ASSISTANT_QUERY (missing context)...');
        ws.send(JSON.stringify({
            type: 'AI_ASSISTANT_QUERY',
            payload: { message: "What is happening?" } // missing 'context'
        }));
        await wait(1000);

        // 4. Send ANALYZE with nulls
        console.log('[test] Sending ANALYZE with null fields...');
        ws.send(JSON.stringify({
            type: 'ANALYZE',
            payload: {
                level_tag: null,
                lore_discovered: null,
                boss_history: [null],
                player_class: undefined
            }
        }));
        await wait(1000);

        console.log('[test] Chaos test sequence complete. Checking server logs for crashes...');
        ws.close();
    });

    ws.on('error', (err) => {
        console.error('[test] Connection error:', err.message);
    });

    ws.on('close', () => {
        console.log('[test] Connection closed.');
    });
}

runChaosTest().catch(console.error);
