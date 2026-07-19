// server/src/document/document.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentService {
  constructor(private prisma: PrismaService) {}

  // 1. Create a new document
  async createDocument(title: string, ownerId: string) {
    return this.prisma.document.create({
      data: {
        title,
        ownerId,
      },
    });
  }

  // 2. Get all documents belonging to a user
  async getUserDocuments(userId: string) {
    return this.prisma.document.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // 3. Get details of a single document
  async getDocument(docId: string, userId: string) {
    const doc = await this.prisma.document.findUnique({
      where: {
        id: docId,
      },
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    return doc;
  }
}