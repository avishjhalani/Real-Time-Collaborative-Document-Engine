import { DocumentService } from './document.service';
export declare class DocumentController {
    private documentService;
    constructor(documentService: DocumentService);
    create(body: {
        title: string;
    }, req: any): Promise<{
        id: string;
        title: string;
        content: import("@prisma/client/runtime/client").Bytes | null;
        ownerId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getAll(req: any): Promise<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getOne(id: string, req: any): Promise<{
        id: string;
        title: string;
        content: import("@prisma/client/runtime/client").Bytes | null;
        ownerId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
