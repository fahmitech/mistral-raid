import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logs will be stored in a 'logs' folder in the server directory
const LOG_DIR = path.resolve(__dirname, '../../logs');

export type LogType = 'telemetry' | 'llm';

class LoggingService {
    private logFiles: Record<LogType, string> = {
        telemetry: path.join(LOG_DIR, 'telemetry.log'),
        llm: path.join(LOG_DIR, 'llm_calls.log'),
    };

    constructor() {
        // Ensure the log directory exists
        if (!fs.existsSync(LOG_DIR)) {
            try {
                fs.mkdirSync(LOG_DIR, { recursive: true });
                console.log(`[LoggingService] Created directory: ${LOG_DIR}`);
            } catch (err) {
                console.error(`[LoggingService] Failed to create log directory:`, err);
            }
        }
    }

    /**
     * Appends a data object to the specified log file as a JSON line.
     */
    async writeLog(type: LogType, data: any): Promise<void> {
        const filePath = this.logFiles[type];
        const entry = {
            timestamp: new Date().toISOString(),
            ...data,
        };

        const line = JSON.stringify(entry) + '\n';

        try {
            await fs.promises.appendFile(filePath, line, 'utf8');
        } catch (error) {
            console.error(`[ERROR] Failed to write to ${type} log:`, error);
        }
    }
}

export const logger = new LoggingService();
