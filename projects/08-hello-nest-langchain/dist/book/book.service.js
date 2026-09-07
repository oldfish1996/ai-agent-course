var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
let BookService = class BookService {
    create(createBookDto) {
        return 'This action adds a new book';
    }
    findAll() {
        return `This action returns all book`;
    }
    findOne(id) {
        return `This action returns a #${id} book`;
    }
    update(id, updateBookDto) {
        return `This action updates a #${id} book`;
    }
    remove(id) {
        return `This action removes a #${id} book`;
    }
};
BookService = __decorate([
    Injectable()
], BookService);
export { BookService };
//# sourceMappingURL=book.service.js.map