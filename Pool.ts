export class Pool<T> {
    cache: T[] = [];
    private length = 0;

    constructor(private factory: () => T) {}

    get() {
        if (this.length === 0) {
            this.cache[0] = this.factory();
            this.length++;
        }
        return this.cache[this.length - 1];
    }

    restore(value: T) {
        this.cache[this.length] = value;
        this.length++;
    }
}