import WebSocket from 'ws';

/**
 * E2E Simulation: Sends story-aware telemetry to a running server.
 */

const WS_URL = 'ws://localhost:3000'; // Default port
const session_id = 'qa-simulation-' + Date.now();

async function runSimulation() {
    console.log(`🚀 Starting simulation for session: ${session_id}`);

    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        console.log('✅ Connected to server');

        // 1. Initial Telemetry
        sendTelemetry(ws, {
            type: 'LIVE_TELEMETRY',
            session_id,
            hp: 100,
            maxHp: 100,
            accuracy: 0.5,
            dashCount: 0,
            playerZone: 'center',
            bossHpPercent: 100,
            playerHpPercent: 100,
            loreInteractionCount: 0,
            wallBias: 10
        });

        // 2. Simulate Lore Interaction after a delay
        setTimeout(() => {
            console.log('📖 Simulating lore interaction...');
            sendTelemetry(ws, {
                type: 'LIVE_TELEMETRY',
                session_id,
                hp: 100,
                maxHp: 100,
                accuracy: 0.5,
                dashCount: 1,
                playerZone: 'center',
                bossHpPercent: 95,
                playerHpPercent: 100,
                loreInteractionCount: 1,
                timeSpentReadingLore: 5,
                wallBias: 20
            });
        }, 2000);

        // 3. Simulate Wall Hugging
        setTimeout(() => {
            console.log('🧱 Simulating wall hugging...');
            sendTelemetry(ws, {
                type: 'LIVE_TELEMETRY',
                session_id,
                hp: 100,
                maxHp: 100,
                accuracy: 0.5,
                dashCount: 2,
                playerZone: 'corner',
                bossHpPercent: 90,
                playerHpPercent: 100,
                loreInteractionCount: 1,
                timeSpentReadingLore: 5,
                wallBias: 95,
                retreatDistance: 200
            });
        }, 4000);

        // End simulation
        setTimeout(() => {
            console.log('🏁 Simulation complete');
            ws.close();
            process.exit(0);
        }, 6000);
    });

    ws.on('error', (err) => {
        console.error('❌ Connection error:', err.message);
        console.log('💡 Make sure the server is running on port 3000');
        process.exit(1);
    });
}

function sendTelemetry(ws: any, payload: any) {
    ws.send(JSON.stringify(payload));
}

runSimulation();
