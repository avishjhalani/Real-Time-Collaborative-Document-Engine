"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const Y = __importStar(require("yjs"));
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
let DocumentGateway = class DocumentGateway {
    prisma;
    redisService;
    jwtService;
    server;
    activeDocs = new Map();
    roomUserCounts = new Map();
    saveTimeouts = new Map();
    constructor(prisma, redisService, jwtService) {
        this.prisma = prisma;
        this.redisService = redisService;
        this.jwtService = jwtService;
    }
    async saveDocumentToDb(docId) {
        const ydoc = this.activeDocs.get(docId);
        if (!ydoc)
            return;
        const content = Buffer.from(Y.encodeStateAsUpdate(ydoc));
        try {
            await this.prisma.document.update({
                where: { id: docId },
                data: { content },
            });
            console.log(`Document ${docId} successfully saved to database.`);
        }
        catch (err) {
            console.error(`Failed to save document ${docId} to database:`, err);
        }
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth?.token ||
                client.handshake.query?.token;
            if (!token) {
                console.log(`Connection rejected: No token provided (${client.id})`);
                client.disconnect(true);
                return;
            }
            const payload = this.jwtService.verify(token, {
                secret: process.env.JWT_SECRET || 'secure-crdt-editor-token-key-2026',
            });
            client.data.userId = payload.sub;
            client.data.username = payload.username;
            client.data.email = payload.email;
            console.log(`WebSocket Authenticated: ${client.data.username} (${client.id})`);
        }
        catch (err) {
            console.log(`Connection rejected: Invalid token (${client.id})`);
            client.disconnect(true);
        }
    }
    async handleDisconnect(client) {
        const { docId, username } = client.data;
        if (!docId)
            return;
        console.log(`Client disconnected: ${client.id} (${username})`);
        const count = (this.roomUserCounts.get(docId) || 1) - 1;
        this.roomUserCounts.set(docId, count);
        if (count === 0) {
            console.log(`No local users left for document ${docId}. Saving to DB and unsubscribing from Redis.`);
            const timeout = this.saveTimeouts.get(docId);
            if (timeout) {
                clearTimeout(timeout);
                this.saveTimeouts.delete(docId);
            }
            await this.saveDocumentToDb(docId);
            await this.redisService.unsubscribe(`doc-updates:${docId}`);
            this.activeDocs.delete(docId);
            this.roomUserCounts.delete(docId);
        }
        client.to(docId).emit('user-left', { username, socketId: client.id });
    }
    async handleJoinDocument(client, data) {
        const { docId } = data;
        const username = client.data.username;
        client.join(docId);
        client.data.docId = docId;
        const currentCount = this.roomUserCounts.get(docId) || 0;
        this.roomUserCounts.set(docId, currentCount + 1);
        let ydoc = this.activeDocs.get(docId);
        if (!ydoc) {
            ydoc = new Y.Doc();
            const dbDoc = await this.prisma.document.findUnique({ where: { id: docId } });
            if (dbDoc && dbDoc.content) {
                Y.applyUpdate(ydoc, dbDoc.content);
            }
            this.activeDocs.set(docId, ydoc);
            await this.redisService.subscribe(`doc-updates:${docId}`, (messageStr) => {
                const updateBinary = new Uint8Array(Buffer.from(messageStr, 'base64'));
                Y.applyUpdate(ydoc, updateBinary);
                this.server.to(docId).emit('update-document', Buffer.from(updateBinary));
            });
        }
        const stateUpdate = Y.encodeStateAsUpdate(ydoc);
        client.emit('init-document-state', Buffer.from(stateUpdate));
        client.to(docId).emit('user-joined', { username, socketId: client.id });
    }
    async handleUpdateDocument(client, updateBinary) {
        const docId = client.data.docId;
        if (!docId)
            return;
        const ydoc = this.activeDocs.get(docId);
        if (ydoc) {
            Y.applyUpdate(ydoc, new Uint8Array(updateBinary));
            const base64Update = Buffer.from(updateBinary).toString('base64');
            await this.redisService.publish(`doc-updates:${docId}`, base64Update);
            const existingTimeout = this.saveTimeouts.get(docId);
            if (existingTimeout) {
                clearTimeout(existingTimeout);
            }
            const timeout = setTimeout(async () => {
                this.saveTimeouts.delete(docId);
                await this.saveDocumentToDb(docId);
            }, 5000);
            this.saveTimeouts.set(docId, timeout);
        }
    }
    handleCursorMove(client, cursorData) {
        const docId = client.data.docId;
        if (!docId)
            return;
        client.to(docId).emit('cursor-move', {
            socketId: client.id,
            username: client.data.username,
            ...cursorData,
        });
    }
    handleAwarenessUpdate(client, awarenessBinary) {
        const docId = client.data.docId;
        if (!docId)
            return;
        client.to(docId).emit('awareness-update', awarenessBinary);
    }
    handlePing() {
        return 'pong';
    }
};
exports.DocumentGateway = DocumentGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], DocumentGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join-document'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], DocumentGateway.prototype, "handleJoinDocument", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('update-document'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket,
        Buffer]),
    __metadata("design:returntype", Promise)
], DocumentGateway.prototype, "handleUpdateDocument", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('cursor-move'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], DocumentGateway.prototype, "handleCursorMove", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('awareness-update'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket,
        Buffer]),
    __metadata("design:returntype", void 0)
], DocumentGateway.prototype, "handleAwarenessUpdate", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('ping'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DocumentGateway.prototype, "handlePing", null);
exports.DocumentGateway = DocumentGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*' },
    }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        jwt_1.JwtService])
], DocumentGateway);
//# sourceMappingURL=document.gateway.js.map