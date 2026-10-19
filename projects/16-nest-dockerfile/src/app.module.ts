import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { BookModule } from './book/book.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from './book/entities/book.entity.js';

const isProduction = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    BookModule,
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: isProduction ? 'mysql-prod' : 'localhost',
      port: 3306,
      username: 'root',
      password: 'admin',
      database: 'book',
      synchronize: true,
      connectorPackage: 'mysql2',
      logging: true,
      autoLoadEntities: true,
      entities: [Book],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
