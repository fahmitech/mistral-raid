import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'llm_calls.log');

/**
 * Ensures the log directory exists.
 */
function ensureLogDir(): void {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

/**
 * Appends a detailed LLM interaction to the log file.
 */
export function logLLMCall(params: {
    model: string;
    purpose: string;
    sessionId?: string;
    prompt: string;
    response?: string;
    error?: string;
    latencyMs?: number;
}): void {
    ensureLogDir();

    const timestamp = new Date().toISOString();
    const sessionId = params.sessionId || 'N/A';
    const separator = '='.repeat(80);

    let logEntry = `\n${separator}\n`;
    logEntry += `TIMESTAMP: ${timestamp}\n`;
    logEntry += `SESSION:   ${sessionId}\n`;
    logEntry += `MODEL:     ${params.model}\n`;
    logEntry += `PURPOSE:   ${params.purpose}\n`;
    if (params.latencyMs !== undefined) {
        logEntry += `LATENCY:   ${params.latencyMs}ms\n`;
    }
    logEntry += `\n--- PROMPT ---\n${params.prompt}\n`;

    if (params.response) {
        logEntry += `\n--- RESPONSE ---\n${params.response}\n`;
    }

    if (params.error) {
        logEntry += `\n--- ERROR ---\n${params.error}\n`;
    }

    logEntry += `${separator}\n`;

    try {
        fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
    } catch (err) {
        console.error('[llm-logger] Failed to write to llm_calls.log:', err);
    }
}
