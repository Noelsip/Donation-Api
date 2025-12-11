require('dotenv').config();
const pool = require('../config/sql');

const createProject = async (req, res) => {
    const { title, description, target_amount } = req.body;
    const user_id = req.user?.user_id;

    if (!user_id) {
        return res.status(401).json({
            message: 'Unauthorized: User not authenticated'
        });
    }

    if (!title || title.trim() === '') {
        return res.status(400).json({
            message: 'Nama Projek tidak boleh kosong'
        });
    }

    if (!target_amount || isNaN(target_amount) || target_amount <= 0) {
        return res.status(400).json({
            message: 'Target amount harus lebih dari 0'
        });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const [rows] = await conn.query(
            'CALL sp_create_project(?, ?, ?, ?)',
            [
                user_id,
                title.trim(),
                description || null,
                target_amount
            ]);

        const resultSet = Array.isArray(rows) ? rows[0] : rows;
        const created = resultSet && resultSet[0] ? resultSet[0] : null;

        return res.status(201).json({
            message: 'Projek berhasil dibuat(menunggu persetujuan)',
            data: {
                project_id: created.project_id,
                title: title,
                target_amount: target_amount,
                status: created.status
            }
        });
    } catch (error) {
        console.error('Error creating project:', error);
        return res.status(500).json({
            message: error.sqlMessage || 'Gagal membuat proyek'
        });
    } finally {
        if (conn) conn.release();
    }
};

const getAllProjects = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { limit = 20, offset = 0 } = req.query;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_list_user_projects(?, ?, ?)',
                [userId, parseInt(limit, 10), parseInt(offset, 10)]
            );

            console.log('Raw result from sp_list_user_projects:', JSON.stringify(result, null, 2));

            const projects = result[0] || [];

            res.status(200).json({
                data: projects,
                count: projects.length
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error get all projects:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat mengambil data project.'
        });
    }
};

const getProjectSummary = async (req, res) => {
    try {
        const { projectId } = req.params;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_get_project_summary(?)',
                [projectId || null]
            );

            res.json({
                data: result[0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error getting project summary:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Gagal mengambil ringkasan proyek'
        });
    }
};

const getFinishedProject = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { limit=20, offset=0 } = req.query;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_list_user_projects(?, ?, ?)',
                [userId, parseInt(limit, 10), parseInt(offset, 10)]
            );

            const rawProjects = result[0] || [];
            const projects = rawProjects.filter( p => {
                const status = 
                    String(
                        p.status ||
                        p.project_status ||
                        ''
                    ).toLowerCase();
                return status === 'closed' || status === 'finished';
            });

            res.status(200).json({
                data: projects,
                count: projects.length
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error get finished projects: ', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat mengambil data project'
        });
    }
};

const listActiveProjects = async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_list_all_active_projects(?, ?)',
                [parseInt(limit, 10), parseInt(offset, 10)]
            );

            console.log('Raw result from sp_list_all_active_projects:', JSON.stringify(result, null, 2));

            const projects = result[0] || [];

            res.status(200).json({
                count: projects.length,
                data: projects
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error get all public projects:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat mengambil data project.'
        });
    }
};

const listPendingProjects = async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_list_pending_projects(?, ?)',
                [parseInt(limit, 10), parseInt(offset, 10)]
            );

            const projects = result[0] || [];

            res.status(200).json({
                message: 'Berhasil mengambil daftar project pending',
                count: projects.length,
                data: projects
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error get pending projects:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat mengambil data project.'
        });
    }
};

const getProjectDetail = async (req, res) => {
    try {
        const { projectId } = req.params;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_get_project_detail(?)',
                [projectId]
            );

            if (!result[0] || result[0].length === 0) {
                return res.status(404).json({
                    message: 'Project tidak ditemukan'
                });
            }

            res.json({
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error get project:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Gagal mengambil data project'
        });
    }
};

const updateProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { projectName, projectDesc, targetAmount } = req.body;
        const userId = req.user.user_id;

        if (!projectName || projectName.trim() === '') {
            return res.status(400).json({
                message: 'Nama Project Tidak Boleh Kosong'
            });
        }

        if (!targetAmount || isNaN(targetAmount) || targetAmount <= 0) {
            return res.status(400).json({
                message: 'Target Amount harus lebih dari 0'
            });
        }

        const conn = await pool.getConnection();
        try {
            const [rows] = await conn.query(
                'CALL sp_update_project(?, ?, ?, ?, ?)',
                [
                    projectId, 
                    userId, 
                    projectName, 
                    projectDesc, 
                    targetAmount
                ]);

            const result = rows[0][0];

            if (result.affected_rows === 0) {
                return res.status(404).json({
                    message: 'Proyek Tidak ditemukan atau tidak dapat diubah'
                });
            }

            res.status(200).json({
                message: 'Project berhasil diperbarui.',
                data: {
                    project_id: result.project_id,
                    update_name: result.updated_name,
                    updated_target: result.updated_target,
                    update_desc: result.update_desc,
                    status: result.status,
                    updated_at: result.updated_at
                }
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat memperbarui project.'
        });
    }
};

const getProjectDonations = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_get_project_donations(?, ?, ?)',
                [projectId, parseInt(limit, 10), parseInt(offset, 10)]
            );

            res.json({
                message: 'Berhasil Mengambil daftar',
                data: result[0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error getting project donations:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Gagal mengambil daftar donasi'
        });
    }
};

const closeProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.user_id;
        const isAdmin = req.user.role === 'ADMIN';

        const conn = await pool.getConnection();
        try {
            if (!isAdmin) {
                const [projectResult] = await conn.query(
                    'SELECT user_id FROM projects WHERE id = ?',
                    [projectId]
                );

                if (!projectResult || projectResult.length === 0) {
                    return res.status(404).json({
                        message: 'Project tidak ditemukan.'
                    });
                }

                if (projectResult[0].user_id !== userId) {
                    return res.status(403).json({
                        message: 'Anda tidak memiliki izin untuk menghapus project ini.'
                    });
                }
            }

            const [result] = await conn.query(
                'CALL sp_close_project(?, ?)',
                [projectId, userId]
            );

            if (result[0][0].affected_rows === 0) {
                return res.status(404).json({
                    message: 'Project tidak ditemukan atau sudah ditutup.'
                });
            }

            res.status(200).json({
                message: 'Project berhasil ditutup.'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat menghapus project.'
        });
    }
};

const searchProjects = async (req, res) => {
    try {
        const { keyword, limit = 20, offset = 0 } = req.query;

        if (!keyword || keyword.trim() === '') {
            return res.status(400).json({
                message: 'Keyword pencarian tidak boleh kosong'
            });
        }

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_search_projects(?, ?, ?)',
                [keyword, parseInt(limit, 10), parseInt(offset, 10)]
            );

            res.status(200).json({
                data: result[0],
                count: result[0].length,
                keyword: keyword,
                message: 'Hasil pencarian project berhasil diambil'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error searching projects:', error);
        res.status(500).json({
            message: 'Internal server error'
        });
    }
};

const activateProject = async (req, res) => {
    try {
        const adminId = req.user.user_id;
        const { projectId } = req.params;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_activate_project(?, ?)',
                [projectId, adminId]
            );

            const row = result[0] && result[0][0] ? result[0][0] : null;
            if (!row || row.affected_rows === 0) {
                return res.status(404).json({
                    message: 'Project tidak ditemukan atau sudah aktif.'
                });
            }

            res.status(200).json({
                message: 'Project berhasil diaktifkan.',
                data: row
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error activating project:', error);
        res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat mengaktifkan project.'
        });
    }
};

const rejectProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { reason } = req.body;
        const adminId = req.user.user_id;
        const userRole = req.user.role;

        if (userRole !== 'ADMIN'){
            return res.status(403).json({
                message: 'Anda tidak memiliki akses'
            });
        }

        if (!reason || reason.trim() === '') {
            return res.status(400).json({
                message: 'Alasan penolakan harus diisi'
            });
        }

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_reject_project(?, ?, ?)',
                [projectId, adminId, reason]
            );

            const spResult = result[0][0];

            if (spResult.affected_rows === 0) {
                return res.status(404).json({
                    message: 'Project tidak ditemukan atau bukan Pending'
                });
            }

            res.status(200).json({
                message: 'Project berhasil ditolak.',
                data: spResult
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error rejecting project: ', error);
        return res.status(500).json({
            message: error.sqlMessage || 'Terjadi kesalahan pada server'
        });
    }
};

const recalculateProjectFunds = async (req, res) => {
    try { 
        const { projectId } = req.params;

        const [result] = await pool.query(
            'CALL sp_recalculate_collected_amount(?)',
            [projectId || null]
        );

        res.status(200).json({
            message: 'Berhasil menghitung ulang dana',
            data: result[0][0]
        });
    } catch (error) {
        console.error('Error recalculating: ', error);
        res.status(500).json({
            message: error.sqlMessage || 'Gagal menghitung ulang'
        });
    }
};

module.exports = {
    createProject,
    getAllProjects,
    updateProject,
    activateProject,
    rejectProject,
    closeProject,
    getProjectDetail,
    getProjectSummary,
    getFinishedProject,
    listActiveProjects,
    listPendingProjects,
    searchProjects,
    getProjectDonations,
    recalculateProjectFunds
};