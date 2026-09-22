// src/routes/index.js
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import studentsRoutes from './students.routes.js';
import academicRoutes from './academic.routes.js';
import feeStructuresRoutes from './feeStructures.routes.js';
import paymentMethodsRoutes from './paymentMethods.routes.js';
import syncRoutes from './sync.routes.js';
import assignmentsRoutes from './assignments.routes.js';
import invoicesRoutes from './invoices.routes.js'; 

const router = Router();

router.use('/auth', authRoutes);
router.use('/students', studentsRoutes);
router.use('/academic', academicRoutes);
router.use('/fee-structures', feeStructuresRoutes);
router.use('/assignments', assignmentsRoutes);
router.use('/payment-methods', paymentMethodsRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/sync', syncRoutes);
export default router;