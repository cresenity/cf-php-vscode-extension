import * as websocket from 'websocket';
import * as http from 'http';
import logger from '../logger';
import { getConfig } from '../config';

const PORT = 3717;
const PROTOCOL = 'reload-protocol';
let wsClient: websocket.client = null;
let wsConnection: websocket.connection = null;
let server: http.Server = null;
let wsServer: websocket.server = null;

export const start = () => {
    const port = getConfig()?.port ?? PORT;
    if (!server) {
        server = http.createServer(function (request, response) {
            console.log((new Date()) + ' Received request for ' + request.url);
            response.writeHead(404);
            response.end();
        });
        server.listen(port, function () {
            console.log((new Date()) + ` Server is listening on port ${port}`);
        });
    }

    if (!wsServer) {
        wsServer = new websocket.server({
            httpServer: server,
            // You should not use autoAcceptConnections for production
            // applications, as it defeats all standard cross-origin protection
            // facilities built into the protocol and the browser.  You should
            // *always* verify the connection's origin and decide whether or not
            // to accept it.
            autoAcceptConnections: false
        });

        wsServer.on('request', function (request) {
            var connection = request.accept(PROTOCOL, request.origin);
            console.log((new Date()) + ' Connection accepted.');

            connection.on('message', function (message) {
                if (message.type === 'utf8') {
                    console.log('Received Message: ' + message.utf8Data);
                    const msg = message.utf8Data;
                    wsServer.broadcastUTF(msg);
                }
                else if (message.type === 'binary') {
                    console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
                    connection.sendBytes(message.binaryData);
                }
            });
            connection.on('close', function (reasonCode, description) {
                console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
            });
        });
    }


}

export const getClient = (): websocket.client => {
    if (!wsClient) {
        wsClient = new websocket.client();

        wsClient.on('connectFailed', function (error) {
            console.log('Connect Error: ' + error.toString());
        });

        wsClient.on('connect', function (connection) {
            wsConnection = connection;
            console.log('WebSocket Client Connected');
            connection.on('error', function (error) {
                console.log("Connection Error: " + error.toString());
            });
            connection.on('close', function () {
                console.log(`${PROTOCOL} Connection Closed`);
            });
            connection.on('message', function (message) {
                if (message.type === 'utf8') {
                    console.log("Received: '" + message.utf8Data + "'");
                }
            });
        });

        const isConnectionClosed = wsConnection?.state != 'open';
        if (isConnectionClosed) {
            wsClient.connect(`ws://localhost:${PORT}/`, PROTOCOL);
        }
    }

    return wsClient;
}

export const reload = () => {
    if (!getConfig().liveReload) return;
    logger.log('reloading...');
    const isConnected = wsConnection?.state == 'open';
    if (isConnected) {
        wsConnection.send('RELOAD');
    } else {
        const client = getClient();
        client.on('connect', function (connection) {
            connection.sendUTF('RELOAD');
        });
    }
}
