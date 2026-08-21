import express from 'express';
import http from 'node:http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './env.js';
import { logger } from './lib/logger.js';
import { initSocket } from './lib/websocket/socket.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { eventsRouter } from './routes/events.js';
import { momentsRouter } from './routes/moments.js';
import { messagesRouter } from './routes/messages.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();
const httpServer = http.createServer(app);

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', eventsRouter);
app.use('/api', momentsRouter);
app.use('/api', messagesRouter);

// The client is a separate deployment (Vercel) that talks to this API cross-origin —
// this process only ever serves /api and /socket.io, never any HTML.
app.use(notFoundHandler);
app.use(errorHandler);

initSocket(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info('server started', { port: env.PORT, env: env.NODE_ENV });
});
