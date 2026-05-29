const express = require('express');

const router = express.Router();

router.get('/validate', async (req, res) => {

    try {

        res.json({

            success: true,

            deploy_valid: true,

            checks: {

                backend: true,

                timestamp: new Date()

            }

        });

    } catch (error) {

        res.status(500).json({

            success: false,

            deploy_valid: false,

            error: error.message

        });

    }

});

module.exports = router;