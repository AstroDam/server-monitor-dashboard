const express = require('express');

const cors = require('cors');

const http = require('http');

const { Server } = require('socket.io');

const authRoutes =
    require('./routes/auth');

const metricsRoutes =
    require('./routes/metrics');

const usersRoutes =
    require('./routes/users');

require('./services/metricsCollector');

require('./services/retentionService');

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