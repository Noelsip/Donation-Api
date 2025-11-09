require('dotenv').config();
const pool = require('../config/sql');

// Create project
const createProject = async (req, res) => {
    const { title, description, target_amount } = req.body;
    const user_id = req.user?.user_id;

    if (!user_id) {
        return res.status(401).json({
            ok: false,
            message: 'Unauthorized: User not authenticated'
        });
    }

    if (!title || !target_amount) {
        return res.status(400).json({
            ok: false,
            message: 'Title dan target amount wajib diisi'
        });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const [rows] = await conn.query(
            'CALL sp_create_project(?, ?, ?, ?)',
            [user_id, title, description, target_amount]
        );

        const resultSet = Array.isArray(rows) ? rows[0] : rows;
        const created = resultSet && resultSet[0] ? resultSet[0] : null;

        return res.status(201).json({
            ok: true,
            message: 'Project created successfully (menunggu persetujuan)',
            data: {
                project_id: created.project_id,
                title: created.title,
                target_amount: created.target_amount,
                status: created.status
            }
        });
    } catch (error) {
        console.error('Error creating project:', error);
        return res.status(500).json({
            ok: false,
            message: error.sqlMessage || 'Internal server error'
        });
    } finally {
        if (conn) conn.release();
    }
};

// Get all projects (for authenticated user)
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

            // Result dari stored procedure biasanya array of arrays
            // result[0] = data rows
            // result[1] = metadata
            const projects = result[0] || [];

            res.status(200).json({
                success: true,
                data: projects,
                count: projects.length
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error get all projects:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat mengambil data project.'
        });
    }
};

// Get ALL projects (public - tanpa filter user)
const getAllPublicProjects = async (req, res) => {
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
                success: true,
                data: projects,
                count: projects.length
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error get all public projects:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat mengambil data project.'
        });
    }
};

// Get project by ID
const getProjectById = async (req, res) => {
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
                    success: false,
                    message: 'Project tidak ditemukan'
                });
            }

            res.json({
                success: true,
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error get project:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Gagal mengambil data project'
        });
    }
};

// Update project
const updateProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { projectName, projectDesc, targetAmount } = req.body;
        const userId = req.user.user_id;

        const conn = await pool.getConnection();
        try {
            const [result] = await conn.query(
                'CALL sp_update_project(?, ?, ?, ?, ?)',
                [projectId, userId, projectName, projectDesc, targetAmount]
            );

            if (result[0][0].affected_rows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Project tidak ditemukan atau Anda tidak memiliki izin untuk mengubahnya.'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Project berhasil diperbarui.',
                data: result[0][0]
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat memperbarui project.'
        });
    }
};

// Delete project
const deleteProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.user_id;
        const isAdmin = req.user.role === 'ADMIN';

        const conn = await pool.getConnection();
        try {
            // Verify permission if not admin
            if (!isAdmin) {
                const [projectResult] = await conn.query(
                    'SELECT user_id FROM projects WHERE id = ?',
                    [projectId]
                );

                if (!projectResult[0] || projectResult[0].user_id !== userId) {
                    return res.status(403).json({
                        success: false,
                        message: 'Anda tidak memiliki izin untuk menghapus project ini.'
                    });
                }
            }

            const [result] = await conn.query(
                'CALL sp_close_project(?)',
                [projectId]
            );

            if (result[0][0].affected_rows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Project tidak ditemukan atau sudah ditutup.'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Project berhasil dihapus.'
            });
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({
            success: false,
            message: error.sqlMessage || 'Terjadi kesalahan pada server saat menghapus project.'
        });
    }
};

module.exports = {
    createProject,
    getAllProjects,
    getAllPublicProjects,
    getProjectById,
    updateProject,
    deleteProject
};