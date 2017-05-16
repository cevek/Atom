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

const changesStack: {stack: {changes: number[], transactionId: number; length: number}[], length: number} = {
    stack: [],
    length: 0
};
let changes: {changes: number[], transactionId: number; length: number};
let transactionId = 0;

export class Atom<T = {}> {
    id = id++;
    fn: () => T;
    value: Maybe<T>;

    parentsArr: (Atom | number)[];
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

    static autorun<T>(fn: () => T, name: string) {
        const atom = new Atom(fn, void 0, name);
        atom.state = AtomState.AUTORUN;
        atom.autorunCall();
    }

    static callAutoruns() {
        for (const atom of autorunAtoms) {
            atom.autorunCall();
        }
        autorunAtoms.clear();
    }

    set(value: T) {
        // console.log('set', value, this);
        this.value = value;
        this.setChildrenMaybeState();
        // Atom.callAutoruns();
    }

    setChildrenMaybeState() {
        if (this.childrenArr !== void 0) {
            for (var i = 0; i < this.childrenArr.length; i++) {
                const child = this.childrenArr[i];
                if (child.state === AtomState.ACTUAL) {
                    // console.log('setChildrenMaybeState', child);
                    child.state = AtomState.PARENTS_MAYBE_UPDATED;
                    child.setChildrenMaybeState();
                }
                else if (child.state === AtomState.AUTORUN) {
                    // autorunAtoms.add(child);
                }
            }
        }
    }

    autorunCall() {
        let prevActiveAtom = activeChildAtom;
        activeChildAtom = this;
        this.clearParents();
        // // console.log('autorunCall', this);
        this.fn();
        activeChildAtom = prevActiveAtom;
    }

    clearParents() {
        for (var i = 0; i < this.parentsArr.length; i += 2) {
            var parent = this.parentsArr[i] as Atom;
            for (var j = 0; j < parent.childrenArr!.length; j++) {
                if (this === parent.childrenArr![j]) {
                    parent.childrenArr!.splice(j, 2);
                    break;
                }
            }
        }
        var len = this.parentsArr.length;
        for (var i = 0; i < len; i++) {
            this.parentsArr.pop();
        }
    }

    removeChild(child: Atom) {
        for (var i = 0; i < this.childrenArr!.length; i++) {
            if (child === this.childrenArr![i]) {
                this.childrenArr!.splice(i, 1);
                return;
            }
        }
    }

    pushIntoParentsIfAbsent(atom: Atom) {
        for (var i = 0; i < this.parentsArr.length; i += 2) {
            if (this.parentsArr[i] === atom) {
                break;
            }
        }
        this.parentsArr.push(atom, atom.value as number);
    }


    recalc() {
        let prevActiveAtom = activeChildAtom;
        activeChildAtom = this;

        // console.log(changesStack);
        if (changesStack.length === 0) {
            changesStack.stack[changesStack.length++] = {
                changes: [],
                transactionId: 0,
                length: 0
            };
        }
        changes = changesStack.stack[--changesStack.length];
        changes.length = this.parentsArr.length;
        if (changes.length > changes.changes.length) {
            changes.changes[changes.length - 1] = -1;
        }
        changes.transactionId = transactionId++;

        // console.log('recalc', this);
        const newValue = this.fn();
        const hasChanged = newValue !== this.value;
        if (hasChanged) {
            this.setChildrenMaybeState();
        }

        let shift = 0;
        // console.log(changes);
        for (var i = 0; i < changes.length; i += 2) {
            if (changes.changes[i] !== changes.transactionId) {
                // console.log(i, shift, this.parentsArr.length);
                const parent = this.parentsArr[i - shift] as Atom;
                parent.removeChild(this);
                this.parentsArr.splice(i - shift, 2);
                shift += 2;
            }
        }
        changesStack.stack[changesStack.length++] = changes;

        this.value = newValue;
        this.state = AtomState.ACTUAL;
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
        for (var i = 0; i < this.childrenArr.length; i++) {
            const child = this.childrenArr[i];
            if (atom === child) {
                return i;
            }
        }
        this.childrenArr.push(atom);
        return -1;
    }

    addParent(atom: Atom) {
        for (var i = 0; i < this.parentsArr.length; i += 2) {
            const parent = this.parentsArr[i];
            if (parent === atom) {
                return i;
            }
        }
        this.parentsArr.push(atom, atom.value as number);
        return -1;
    }

    get(): T {
        if ((this.state === AtomState.PARENTS_MAYBE_UPDATED && this.needToRecalc()) || this.state === AtomState.NOT_CALLED) {
            this.recalc();
        }
        if (activeChildAtom !== void 0) {
            const foundPos = activeChildAtom.addParent(this);
            if (foundPos === -1) {
                this.addChild(activeChildAtom);
            } else {
                changes.changes[foundPos] = changes.transactionId;
            }
        }
        return this.value!;
    }
}

