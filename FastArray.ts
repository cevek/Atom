export class FastArray<T> {
    readonly items: T[] = [];
    length = 0;

    push(value: T) {
        this.items[this.length] = value;
        this.length++;
    }

    pop() {
        this.length--;
        return this.items[this.length];
    }

    reset() {
        this.length = 0;
    }

    fullReset() {
        this.length = 0;
        for (let i = 0; i < this.items.length; i++) {
            this.items[i] = (void 0)!;
        }
    }

    lastIndexOf(value: T) {
        for (let i = this.length - 1; i >= 0; i--) {
            if (this.items[i] === value) {
                return i;
            }
        }
        return -1;
    }

    indexOf(value: T) {
        for (let i = 0; i < this.length; i++) {
            if (this.items[i] === value) {
                return i;
            }
        }
        return -1;
    }

    removeUniqueItem(item: T) {
        const items = this.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i] === item) {
                for (let j = i; j < items.length - 1; j++) {
                    items[j] = items[j + 1];
                }
                this.length--;
                items[this.length] = (void 0)!;
                return true;
            }
        }
        return false;
    }
}