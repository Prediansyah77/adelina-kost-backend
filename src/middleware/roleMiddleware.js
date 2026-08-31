// ==========================================
// ROLE AUTHORIZATION MIDDLEWARE
// ==========================================

const authorizeRole = (...allowedRoles) => {

    return (req, res, next) => {

        // ======================================
        // CEK USER
        // ======================================

        if (!req.user) {

            return res.status(401).json({
                success: false,
                message: "User belum terautentikasi"
            });

        }


        // ======================================
        // CEK ROLE
        // ======================================

        if (!allowedRoles.includes(req.user.role)) {

            return res.status(403).json({
                success: false,
                message: "Anda tidak memiliki akses ke halaman ini"
            });

        }


        // ======================================
        // LANJUT
        // ======================================

        next();

    };

};


module.exports = authorizeRole;