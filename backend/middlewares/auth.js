const jwt = require('jsonwebtoken');

const SECRET =
    'monitor-secret-key';

function authMiddleware(
    req,
    res,
    next
) {

    const authHeader =
        req.headers.authorization;

    if (!authHeader) {

        return res.status(401)
            .json({

                error:
                    'Token não enviado'

            });

    }

    const token =
        authHeader.split(' ')[1];

    try {

        const decoded =
            jwt.verify(
                token,
                SECRET
            );

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401)
            .json({

                error:
                    'Token inválido'

            });

    }

}

module.exports =
    authMiddleware;