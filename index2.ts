type Maybe<T> = T | undefined;

const enum AtomState {
    ACTUAL = 1,
    NOT_CALLED = 10,
    PARENTS_MAYBE_UPDATED = 100,
    AUTORUN = 1000,
}

let activeChildAtom: Atom;
let autorunAtoms = new Set();
let id = 0;

type ValueId = number;
type TransactionId = number;

let calcInfoTrId = 0;

class CalcInfo {
    addedParents = new FastArray<Atom>();
    changes: TransactionId[] = [];
    changesCount = 0;
    transactionId: TransactionId = 0;

    init() {
        this.changesCount = 0;
        this.addedParents.reset();
        this.transactionId = calcInfoTrId++;
    }

    sortAdded() {
        if (this.addedParents.items.length < 50) {
            return selectSort(this.addedParents.items, this.addedParents.length) as Atom[];
        }
        return heapSort(this.addedParents.items, this.addedParents.length) as Atom[];
    }

    touch(foundParentPos: number) {
        if (this.changes[foundParentPos] !== this.transactionId) {
            this.changesCount++;
            this.changes[foundParentPos] = this.transactionId;
        }
    }

    addParentIfNonExistent(parent: Atom) {
        if (this.addedParents.lastIndexOf(parent) === -1) {
            this.addedParents.push(parent);
            return true;
        }
        return false;
    }
}

class FastArray<T> {
    readonly items: T[] = [];
    length = 0;

    push(value: T) {
        this.items[this.length++] = value;
    }

    pop() {
        return this.items[--this.length];
    }

    reset() {
        this.length = 0;
    }

    lastIndexOf(value: T) {
        for (var i = this.length - 1; i >= 0; i--) {
            if (this.items[i] === value) {
                return i;
            }
        }
        return -1;
    }

    indexOf(value: T) {
        for (var i = 0; i < this.length; i++) {
            if (this.items[i] === value) {
                return i;
            }
        }
        return -1;
    }
}

class Pool<T> {
    private cache: T[] = [];
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

const calcInfoPool = new Pool(() => new CalcInfo());

export class Atom<T = {}> {
    id = id++;
    valueId: ValueId = 0;
    fn: () => T;
    value: Maybe<T>;

    calcInfo: CalcInfo;
    parentsArr: (Atom | ValueId)[];
    childrenArr: Maybe<Atom[]>;

    state: AtomState;

    private constructor(fn: Maybe<() => T>, value: Maybe<T>, public name: string) {
        this.fn = fn!;
        this.value = value;
        this.parentsArr = fn === void 0 ? (void 0)! : [];
        this.childrenArr = void 0;
        this.value = value;
        this.state = fn === void 0 ? AtomState.ACTUAL : AtomState.NOT_CALLED;
    }

    static value<T>(value: T, name: string) {
        return new Atom(void 0, value, name);
    }

    static calc<T>(fn: () => T, name: string) {
        return new Atom(fn, void 0, name);
    }

    set(value: T) {
        this.value = value;
        this.setChildrenMaybeState();
    }

    setChildrenMaybeState() {
        if (this.childrenArr !== void 0) {
            for (var i = 0; i < this.childrenArr.length; i++) {
                const child = this.childrenArr[i];
                if (child.state === AtomState.ACTUAL) {
                    child.state = AtomState.PARENTS_MAYBE_UPDATED;
                    child.setChildrenMaybeState();
                }
                else if (child.state === AtomState.AUTORUN) {
                    autorunAtoms.add(child);
                }
            }
        }
    }

    removeChild(child: Atom) {
        if (this.childrenArr !== void 0) {
            const childPos = indexOf(this.childrenArr, child);
            if (childPos > -1) {
                removeItem(this.childrenArr, childPos);
            }
        }
    }

    rebuildParents() {
        if (this.calcInfo.changesCount === this.parentsArr.length && this.calcInfo.addedParents.length === 0) {
            return this.parentsArr;
        }
        const newParentsArr: (Atom | ValueId)[] = new Array((this.calcInfo.changesCount + this.calcInfo.addedParents.length) * 2);
        const addedParents = this.calcInfo.sortAdded();

        let j = 0;
        for (let i = 0; i < this.parentsArr.length; i += 2) {
            const parent = this.parentsArr[i] as Atom;
            if (this.calcInfo.changes[i] === this.calcInfo.transactionId) {
                while (j < addedParents.length) {
                    const nextAddedParent = addedParents[j];
                    if (nextAddedParent.id > parent.id) {
                        break;
                    }
                    newParentsArr.push(nextAddedParent, nextAddedParent.valueId);
                    j++;
                }
                newParentsArr.push(parent, parent.valueId);
            } else {
                parent.removeChild(this);
            }
        }
        return newParentsArr;
    }

    recalc() {
        let prevActiveAtom = activeChildAtom;
        activeChildAtom = this;
        this.calcInfo = calcInfoPool.get();
        this.calcInfo.init();
        const newValue = this.fn();
        const hasChanged = newValue !== this.value;
        if (hasChanged) {
            this.valueId++;
            this.value = newValue;
            this.setChildrenMaybeState();
        }
        this.parentsArr = this.rebuildParents();
        this.state = AtomState.ACTUAL;
        calcInfoPool.restore(this.calcInfo);
        this.calcInfo = (void 0)!;
        activeChildAtom = prevActiveAtom;
        return hasChanged;
    }

    needToRecalc() {
        if (this.state === AtomState.PARENTS_MAYBE_UPDATED) {
            for (var i = 0; i < this.parentsArr.length; i += 2) {
                const parent = this.parentsArr[i] as Atom;
                const value = this.parentsArr[i + 1];
                if (parent.value !== value || parent.needToRecalc()) {
                    if (this.recalc()) {
                        return true;
                    }
                }
            }
            this.state = AtomState.ACTUAL;
        }
        return false;
    }

    addChild(atom: Atom) {
        if (this.childrenArr === void 0) {
            this.childrenArr = [];
        }
        this.childrenArr.push(atom);
    }

    addParent(parent: Atom) {
        const foundParentPos = this.searchParent(parent);
        if (foundParentPos === -1) {
            return this.calcInfo.addParentIfNonExistent(parent);
        } else {
            this.calcInfo.touch(foundParentPos);
            return true;
        }
    }

    get(): T {
        if ((this.state === AtomState.PARENTS_MAYBE_UPDATED && this.needToRecalc()) || this.state === AtomState.NOT_CALLED) {
            this.recalc();
        }
        if (activeChildAtom !== void 0) {
            if (activeChildAtom.addParent(this)) {
                this.addChild(activeChildAtom);
            }
        }
        return this.value!;
    }

    private searchParent(search: Atom) {
        var minI = 0;
        var maxI = this.parentsArr.length >> 1;
        var curI, curEl;
        while (minI <= maxI) {
            curI = (minI + maxI) >> 1;
            curEl = (this.parentsArr[curI << 1] as Atom).id;
            if (curEl < search.id) {
                minI = curI + 1;
            } else if (curEl > search.id) {
                maxI = curI - 1;
            } else {
                return curI;
            }
        }
        return -1;
    }
}

function lastIndexOf<T>(arr: T[], value: T) {
    for (var i = arr.length - 1; i >= 0; i--) {
        if (arr[i] === value) {
            return i;
        }
    }
    return -1;
}

function indexOf<T>(arr: T[], value: T) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] === value) {
            return i;
        }
    }
    return -1;
}

function removeItem<T>(arr: T[], pos: number) {
    for (var i = pos; i < arr.length - 1; i++) {
        arr[i] = arr[i + 1];
    }
    arr.pop();
    return arr;
}

function insertItem<T>(arr: T[], pos: number, value: T) {
    arr.push(null!);
    for (var i = arr.length - 1; i > pos; i--) {
        arr[i] = arr[i - 1];
    }
    arr[pos] = value;
    return arr;
}


type SortArrWithId = {[n: number]: {id: number}};

function heapify(array: SortArrWithId, index: number, heapSize: number) {
    var left = (index << 1) + 1,
        right = (index << 1) + 2,
        largest = index;

    if (left < heapSize && array[left].id > array[index].id)
        largest = left;

    if (right < heapSize && array[right].id > array[largest].id)
        largest = right;

    if (largest !== index) {
        var temp = array[index];
        array[index] = array[largest];
        array[largest] = temp;
        heapify(array, largest, heapSize);
    }
}

function buildMaxHeap(array: SortArrWithId, length: number) {
    for (var i = length >> 1; i >= 0; i -= 1) {
        heapify(array, i, length);
    }
    return array;
}

function heapSort(array: SortArrWithId, length: number) {
    var size = length;
    var temp;
    buildMaxHeap(array, length);
    for (var i = length - 1; i > 0; i -= 1) {
        temp = array[0];
        array[0] = array[i];
        array[i] = temp;
        size -= 1;
        heapify(array, 0, size);
    }
    return array;
}

function selectSort(arr: SortArrWithId, length: number) {
    var min, tmp;
    for (var i = 0; i < length; i++) {
        min = i;
        for (var j = i + 1; j < length; j++) {
            if (arr[min].id > arr[j].id) {
                min = j;
            }
        }
        if (min !== i) {
            tmp = arr[i];
            arr[i] = arr[min];
            arr[min] = tmp;
        }
    }

    return arr;
}

