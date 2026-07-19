import { PrismaService } from '../prisma/prisma.service';
export declare class DocumentService {
    private prisma;
    constructor(prisma: PrismaService);
    createDocument(title: string, ownerId: string): Promise<{
        id: string;
        title: string;
        content: import("@prisma/client/runtime/client").Bytes | null;
        ownerId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getUserDocuments(userId: string): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getDocument(docId: string, userId: string): Promise<{
        id: string;
        title: string;
        content: import("@prisma/client/runtime/client").Bytes | null;
        ownerId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
