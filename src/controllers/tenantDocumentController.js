const db = require("../config/database");
const fs = require("fs");
const path = require("path");


// ============================================================
// UPLOAD / REPLACE KTP
// POST /api/tenant-documents/:tenantId/ktp
// ============================================================

const uploadKtp = async (req, res) => {

    try {

        const { tenantId } = req.params;


        // ====================================================
        // VALIDASI TENANT ID
        // ====================================================

        if (
            !tenantId ||
            Number.isNaN(Number(tenantId))
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "ID penghuni tidak valid"

            });

        }


        // ====================================================
        // VALIDASI FILE
        // ====================================================

        if (!req.file) {

            return res.status(400).json({

                success: false,

                message:
                    "File KTP wajib diupload"

            });

        }


        // ====================================================
        // CEK TENANT
        // ====================================================

        const [tenants] =
            await db.query(`
                SELECT
                    id,
                    name

                FROM tenants

                WHERE id = ?

                LIMIT 1
            `, [tenantId]);


        if (
            tenants.length === 0
        ) {

            // Hapus file yang sudah terlanjur diupload
            // jika penghuni tidak ditemukan.

            fs.unlink(
                req.file.path,
                () => { }
            );


            return res.status(404).json({

                success: false,

                message:
                    "Penghuni tidak ditemukan"

            });

        }


        // ====================================================
        // CEK KTP LAMA
        // ====================================================

        const [existingDocuments] =
            await db.query(`
                SELECT
                    id,
                    file_path

                FROM tenant_documents

                WHERE tenant_id = ?

                AND document_type = 'ktp'

                LIMIT 1
            `, [tenantId]);


        // ====================================================
        // PATH FILE BARU
        // ====================================================

        const filePath =
            path.relative(
                path.join(
                    __dirname,
                    ".."
                ),
                req.file.path
            ).replace(/\\/g, "/");


        // ====================================================
        // JIKA KTP SUDAH ADA
        // UPDATE
        // ====================================================

        if (
            existingDocuments.length > 0
        ) {

            const oldDocument =
                existingDocuments[0];


            await db.query(`
                UPDATE tenant_documents

                SET
                    file_path = ?

                WHERE id = ?
            `, [
                filePath,
                oldDocument.id
            ]);


            // =================================================
            // HAPUS FILE KTP LAMA
            // =================================================

            const oldFilePath =
                path.join(
                    __dirname,
                    "..",
                    oldDocument.file_path
                );


            if (
                fs.existsSync(
                    oldFilePath
                )
            ) {

                fs.unlink(
                    oldFilePath,
                    () => { }
                );

            }


            return res.json({

                success: true,

                message:
                    "KTP berhasil diperbarui",

                data: {

                    tenant_id:
                        Number(tenantId),

                    tenant_name:
                        tenants[0].name,

                    document_type:
                        "ktp",

                    file_path:
                        filePath

                }

            });

        }


        // ====================================================
        // JIKA BELUM ADA KTP
        // INSERT
        // ====================================================

        await db.query(`
            INSERT INTO tenant_documents
            (
                tenant_id,
                document_type,
                file_path
            )

            VALUES (?, 'ktp', ?)
        `, [
            tenantId,
            filePath
        ]);


        // ====================================================
        // RESPONSE
        // ====================================================

        res.status(201).json({

            success: true,

            message:
                "KTP berhasil diupload",

            data: {

                tenant_id:
                    Number(tenantId),

                tenant_name:
                    tenants[0].name,

                document_type:
                    "ktp",

                file_path:
                    filePath

            }

        });


    } catch (error) {

        console.error(
            "Upload KTP Error:",
            error
        );


        // ====================================================
        // HAPUS FILE JIKA DATABASE ERROR
        // ====================================================

        if (
            req.file &&
            req.file.path &&
            fs.existsSync(
                req.file.path
            )
        ) {

            fs.unlink(
                req.file.path,
                () => { }
            );

        }


        res.status(500).json({

            success: false,

            message:
                "Gagal menyimpan KTP",

            error:
                error.message

        });

    }

};


// ============================================================
// GET KTP
// GET /api/tenant-documents/:tenantId/ktp
// ============================================================

const getKtp = async (req, res) => {

    try {

        const { tenantId } =
            req.params;


        // ====================================================
        // VALIDASI ID
        // ====================================================

        if (
            !tenantId ||
            Number.isNaN(Number(tenantId))
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "ID penghuni tidak valid"

            });

        }


        // ====================================================
        // AMBIL DATA KTP
        // ====================================================

        const [documents] =
            await db.query(`
                SELECT

                    td.id,

                    td.tenant_id,

                    t.name AS tenant_name,

                    td.document_type,

                    td.file_path,

                    td.created_at,

                    td.updated_at

                FROM tenant_documents td

                INNER JOIN tenants t
                    ON td.tenant_id = t.id

                WHERE td.tenant_id = ?

                AND td.document_type = 'ktp'

                LIMIT 1
            `, [tenantId]);


        // ====================================================
        // KTP TIDAK DITEMUKAN
        // ====================================================

        if (
            documents.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "KTP penghuni belum tersedia"

            });

        }


        res.json({

            success: true,

            data:
                documents[0]

        });


    } catch (error) {

        console.error(
            "Get KTP Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal mengambil data KTP",

            error:
                error.message

        });

    }

};


// ============================================================
// DELETE KTP
// DELETE /api/tenant-documents/:tenantId/ktp
// ============================================================

const deleteKtp = async (req, res) => {

    try {

        const { tenantId } =
            req.params;


        // ====================================================
        // AMBIL DOKUMEN
        // ====================================================

        const [documents] =
            await db.query(`
                SELECT
                    id,
                    file_path

                FROM tenant_documents

                WHERE tenant_id = ?

                AND document_type = 'ktp'

                LIMIT 1
            `, [tenantId]);


        if (
            documents.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "KTP tidak ditemukan"

            });

        }


        const document =
            documents[0];


        // ====================================================
        // HAPUS DATABASE
        // ====================================================

        await db.query(`
            DELETE FROM tenant_documents

            WHERE id = ?
        `, [
            document.id
        ]);


        // ====================================================
        // HAPUS FILE
        // ====================================================

        const filePath =
            path.join(
                __dirname,
                "..",
                document.file_path
            );


        if (
            fs.existsSync(
                filePath
            )
        ) {

            fs.unlink(
                filePath,
                () => { }
            );

        }


        res.json({

            success: true,

            message:
                "KTP berhasil dihapus"

        });


    } catch (error) {

        console.error(
            "Delete KTP Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Gagal menghapus KTP",

            error:
                error.message

        });

    }

};


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    uploadKtp,

    getKtp,

    deleteKtp

};