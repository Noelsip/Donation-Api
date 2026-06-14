import express from 'express';
import { deletePengguna } from '../controllers/deleteUserController.js';

const router = express.Router();

router.delete('/pengguna/:id', deletePengguna);

export default router;
