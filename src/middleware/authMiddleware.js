const jwt = require("jsonwebtoken");

// ==========================================
// JWT AUTHENTICATION MIDDLEWARE
// ==========================================

const authenticateToken = (req, res, next) => {
    try {
        // Ambil header Authorization
        const authHeader = req.headers.authorization;

        // Jika token tidak ada
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Token tidak ditemukan"
            });
        }

        // Format yang benar:
        // Authorization: Bearer TOKEN
        const parts = authHeader.split(" ");

        if (parts.length !== 2 || parts[0] !== "Bearer") {
            return res.status(401).json({
                success: false,
                message: "Format token tidak valid"
            });
        }

        const token = parts[1];

        // Verifikasi JWT
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // Simpan data user ke request
        req.user = decoded;

        // Lanjut ke controller
        next();

    } catch (error) {
        console.error("JWT Middleware Error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Token tidak valid atau sudah kedaluwarsa"
        });
    }
};

module.exports = authenticateToken;