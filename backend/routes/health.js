const express = require('express');

const router = express.Router();

router.get('/', async (req, res) => {

    try {

        res.json({

            status: 'healthy',

            timestamp: new Date(),

            uptime_seconds: process.uptime(),

            memory_usage_mb:
                Math.round(
                    process.memoryUsage().rss /
                    1024 / 1024
                ),

            node_version:
                process.version

        });

    } catch (error) {

        res.status(500).json({

            status: 'unhealthy',

            error: error.message

        });

    }

});

module.exports = router;