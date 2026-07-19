import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
export declare class DocumentGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private prisma;
    private redisService;
    private jwtService;
    server: Server;
    private activeDocs;
    private roomUserCounts;
    private saveTimeouts;
    constructor(prisma: PrismaService, redisService: RedisService, jwtService: JwtService);
    saveDocumentToDb(docId: string): Promise<void>;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    handleJoinDocument(client: Socket, data: {
        docId: string;
    }): Promise<void>;
    handleUpdateDocument(client: Socket, updateBinary: Buffer): Promise<void>;
    handleCursorMove(client: Socket, cursorData: {
        x: number;
        y: number;
        selectionRange: any;
    }): void;
    handleAwarenessUpdate(client: Socket, awarenessBinary: Buffer): void;
    handlePing(): string;
}
