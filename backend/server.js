const express = require('express');

const healthRoutes =
    require('./routes/health');

const cors = require('cors');

const http = require('http');

const { Server } = require('socket.io');

const authRoutes =
    require('./routes/auth');

const metricsRoutes =
    require('./routes/metrics');

const deployRoutes = require('./routes/deploy');

const deployRegistryRoutes =
    require('./routes/deployRegistry');

const usersRoutes =
    require('./routes/users');

const rollbackRoutes =
    require('./routes/rollback');

require('./services/metricsCollector');

require('./services/retentionService');

require('./services/incidentService');

const app = express();

const server =
    http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

app.use(cors());

app.use(express.json());

app.use('/auth', authRoutes);

app.use('/metrics', metricsRoutes);

app.use('/users', usersRoutes);

app.use('/health', healthRoutes);

app.use('/deploy', deployRoutes);

app.use('/rollback', rollbackRoutes);

app.use(
    '/deploy-registry',
    deployRegistryRoutes
);

// SOCKET GLOBAL

global.io = io;

io.on('connection', socket => {
    console.log(
        'Cliente conectado:',
        socket.id
    );

    socket.on('disconnect', () => {
        console.log(
            'Cliente desconectado:',
            socket.id
        );
    });
});

server.listen(3000, () => {
    console.log(
        'Servidor rodando em http://localhost:3000'
    );
});