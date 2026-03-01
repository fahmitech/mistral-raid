import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'llm_calls.log');

let logStream: fs.WriteStream | null = null;

/**
 * Ensures the log directory exists and returns the write stream.
 */
function getLogStream(): fs.WriteStream {
    if (logStream) return logStream;

    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
    logStream.on('error', (err) => {
        console.error('[llm-logger] Log write error:', err);
        logStream = null;
    });
    return logStream;
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
        const stream = getLogStream();
        stream.write(logEntry);
    } catch (err) {
        console.error('[llm-logger] Failed to write to llm_calls.log:', err);
    }
}
