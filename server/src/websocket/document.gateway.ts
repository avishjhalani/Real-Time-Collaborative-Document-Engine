// server/src/websocket/document.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class DocumentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeDocs = new Map<string, Y.Doc>();
  private roomUserCounts = new Map<string, number>();
  private saveTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private jwtService: JwtService, // Inject JwtService
  ) {}

  // Helper method to save Y.Doc state to the PostgreSQL database
  async saveDocumentToDb(docId: string) {
    const ydoc = this.activeDocs.get(docId);
    if (!ydoc) return;

    const content = Buffer.from(Y.encodeStateAsUpdate(ydoc));
    try {
      await this.prisma.document.update({
        where: { id: docId },
        data: { content },
      });
      console.log(`Document ${docId} successfully saved to database.`);
    } catch (err) {
      console.error(`Failed to save document ${docId} to database:`, err);
    }
  }

  // 1. Authenticate connection handshake
  async handleConnection(client: Socket) {
    try {
      // Extract token from query parameters or socket auth payload
      const token = 
        client.handshake.auth?.token || 
        client.handshake.query?.token as string;

      if (!token) {
        console.log(`Connection rejected: No token provided (${client.id})`);
        client.disconnect(true);
        return;
      }

      // Verify token
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'secure-crdt-editor-token-key-2026',
      });

      // Save user details on the socket session
      client.data.userId = payload.sub;
      client.data.username = payload.username;
      client.data.email = payload.email;

      console.log(`WebSocket Authenticated: ${client.data.username} (${client.id})`);
    } catch (err) {
      console.log(`Connection rejected: Invalid token (${client.id})`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const { docId, username } = client.data;
    if (!docId) return;

    console.log(`Client disconnected: ${client.id} (${username})`);

    const count = (this.roomUserCounts.get(docId) || 1) - 1;
    this.roomUserCounts.set(docId, count);

    if (count === 0) {
      console.log(`No local users left for document ${docId}. Saving to DB and unsubscribing from Redis.`);
      
      // Clear pending debounce save timeout and save immediately
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

  // 2. Join a document room (Secure - no username parameter needed from client)
  @SubscribeMessage('join-document')
  async handleJoinDocument(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { docId: string },
  ) {
    const { docId } = data;
    const username = client.data.username; // Extract verified username from socket session
    
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

      // Subscribe to Redis Pub/Sub
      await this.redisService.subscribe(`doc-updates:${docId}`, (messageStr) => {
        const updateBinary = new Uint8Array(Buffer.from(messageStr, 'base64'));
        Y.applyUpdate(ydoc!, updateBinary);
        this.server.to(docId).emit('update-document', Buffer.from(updateBinary));
      });
    }

    const stateUpdate = Y.encodeStateAsUpdate(ydoc);
    client.emit('init-document-state', Buffer.from(stateUpdate));
    client.to(docId).emit('user-joined', { username, socketId: client.id });
  }

  @SubscribeMessage('update-document')
  async handleUpdateDocument(
    @ConnectedSocket() client: Socket,
    @MessageBody() updateBinary: Buffer,
  ) {
    const docId = client.data.docId;
    if (!docId) return;

    const ydoc = this.activeDocs.get(docId);
    if (ydoc) {
      Y.applyUpdate(ydoc, new Uint8Array(updateBinary));
      const base64Update = Buffer.from(updateBinary).toString('base64');
      await this.redisService.publish(`doc-updates:${docId}`, base64Update);

      // Debounce database save to avoid spamming PostgreSQL on every keystroke
      const existingTimeout = this.saveTimeouts.get(docId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      const timeout = setTimeout(async () => {
        this.saveTimeouts.delete(docId);
        await this.saveDocumentToDb(docId);
      }, 5000); // 5 seconds debounce
      this.saveTimeouts.set(docId, timeout);
    }
  }

  @SubscribeMessage('cursor-move')
  handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() cursorData: { x: number; y: number; selectionRange: any },
  ) {
    const docId = client.data.docId;
    if (!docId) return;

    client.to(docId).emit('cursor-move', {
      socketId: client.id,
      username: client.data.username,
      ...cursorData,
    });
  }

  // Awareness protocol updates for cursors
  @SubscribeMessage('awareness-update')
  handleAwarenessUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() awarenessBinary: Buffer,
  ) {
    const docId = client.data.docId;
    if (!docId) return;

    client.to(docId).emit('awareness-update', awarenessBinary);
  }

  @SubscribeMessage('ping')
  handlePing() {
    return 'pong';
  }
}