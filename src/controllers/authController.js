const db = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ==========================================
// LOGIN
// POST /api/auth/login
// ==========================================

const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // ======================================
        // VALIDASI INPUT
        // ======================================

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username dan password wajib diisi"
            });
        }

        // ======================================
        // CARI USER
        // ======================================

        const [users] = await db.query(`
            SELECT *
            FROM users
            WHERE username = ?
            LIMIT 1
        `, [username]);

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Username atau password salah"
            });
        }

        const user = users[0];

        // ======================================
        // CEK PASSWORD
        // ======================================

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Username atau password salah"
            });
        }

        // ======================================
        // BUAT JWT
        // ======================================

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        // ======================================
        // RESPONSE
        // ======================================

        res.json({
            success: true,
            message: "Login berhasil",

            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    username: user.username,
                    role: user.role
                },

                token
            }
        });

    } catch (error) {
        console.error("Login Error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal melakukan login",
            error: error.message
        });
    }
};

module.exports = {
    login
};