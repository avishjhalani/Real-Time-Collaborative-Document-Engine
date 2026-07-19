// server/src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { WebsocketModule } from './websocket/websocket.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { DocumentModule } from './document/document.module';

@Module({
  imports: [PrismaModule, WebsocketModule,RedisModule,AuthModule,DocumentModule], 
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}