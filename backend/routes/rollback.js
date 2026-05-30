const express = require('express');
const { exec } = require('child_process');

const router = express.Router();

router.post('/run', async (req, res) => {
    exec('./scripts/rollback.sh', {
        cwd: process.cwd().replace('/backend', '')
    }, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message,
                stderr,
                stdout
            });
        }

        res.json({
            success: true,
            stdout,
            stderr
        });
    });
});

module.exports = router;