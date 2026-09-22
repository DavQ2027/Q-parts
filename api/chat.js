import { createChatHandler } from '../server/chat/service.js';

// Vercel Node.js Function. GEMINI_API_KEY existe únicamente en el servidor.
const handle = createChatHandler();
export default { fetch: handle };
