// src/app.js
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { env } from './config/env.js';

export const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (env.isDev) app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true, env: env.NODE_ENV }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);