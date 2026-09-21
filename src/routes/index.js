// src/routes/index.js
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import studentsRoutes from './students.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/students', studentsRoutes);

export default router;