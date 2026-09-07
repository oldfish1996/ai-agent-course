import { BookService } from './book.service.js';
import { CreateBookDto } from './dto/create-book.dto.js';
import { UpdateBookDto } from './dto/update-book.dto.js';
export declare class BookController {
    private readonly bookService;
    constructor(bookService: BookService);
    create(createBookDto: CreateBookDto): string;
    findAll(): string;
    findOne(id: string): string;
    update(id: string, updateBookDto: UpdateBookDto): string;
    remove(id: string): string;
}
