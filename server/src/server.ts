import * as express from "express";
import * as http from "http";
import * as socketIo from "socket.io";
import * as redis from 'socket.io-redis';
import * as logger from 'morgan';
import * as cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';

import { UserFunctions } from './services/user';

import { SpotifyService } from './services/spotify';

class Server {
    public static readonly PORT: number = 8080;
    public static readonly APP_PREFIX: string = "HJBV";
    public app: any;
    private server: any;
    private io: SocketIO.Server;
    private spotify: SpotifyService;
    private port: number;

    public static bootstrap(): Server {
        return new Server().bootstrap();
    }

    constructor() {
        this.createApp();
        this.config();
        this.createServer();
        this.sockets();
        this.services();
        this.listen();
    }

    private bootstrap(): Server {

        return this;
    }

    private createApp(): void {
        this.app = express();
    }

    private createServer(): void {
        this.server = http.createServer(this.app);
    }

    private config(): void {
        this.port = parseInt(process.env.PORT) || Server.PORT;
    }

    private sockets(): void {
        this.io = socketIo(this.server);
    }

    private services(): void {
        this.spotify = SpotifyService.bootstrap();
    }

    private listen(): void {
        this.server.listen(this.port, () => {
            console.log('Running server on port %s', this.port);
        });

        this.io.on('connect', (socket: SocketIO.Socket) => {
            let connectedUserMap: Map<string, any> = UserFunctions.getMap();
            connectedUserMap.set(socket.id, { status:'online', name: 'none' });

            console.log('Connected client on port %s.', this.port);
            console.log('Connected client id : %s.', socket.id);

            socket.on('recieveUserName', (data) => {
                let user = connectedUserMap.get(socket.id);
                user.name = data.name;
                console.log('Connected client name : %s.', user.name);
                this.spotify.register_hooks(this.io, socket, Server.APP_PREFIX);
            });
            socket.on('disconnect', () => {
                console.log('Client disconnected');
                let user = connectedUserMap.get(socket.id);
                user.status = 'offline';
            });
        });
    }
}

const server = Server.bootstrap();
const app = server.app;
export default app;