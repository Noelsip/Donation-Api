import { db } from '../db.js';

export const deletePengguna = async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res.status(400).json({
      success: false,
      message: 'ID pengguna tidak valid'
    });
  }

  try {
    await db.query('CALL sp_delete_pengguna(?)', [id]);

    return res.status(200).json({
      success: true,
      message: 'Pengguna berhasil dihapus'
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.sqlMessage || 'Gagal menghapus pengguna'
    });
  }
};
