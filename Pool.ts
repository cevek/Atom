export class Pool<T> {
    cache: T[] = [];
    private pos = 0;

    constructor(private factory: () => T) {}

    get() {
        if (this.pos >= this.cache.length) {
            this.cache.push(this.factory());
        }
        this.pos++;
        return this.cache[this.pos - 1];
    }

    restore() {
        this.pos--;
    }
}