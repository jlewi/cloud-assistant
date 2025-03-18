export declare class RingBuffer<T> {
    private buffer;
    private head;
    private tail;
    private size;
    constructor(capacity: number);
    push(line: T): void;
    get length(): number;
    getAll(): T[];
}
