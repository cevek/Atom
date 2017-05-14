type Maybe<T> = T | undefined;
const enum AtomState {
    ACTUAL = 1,
    NOT_CALLED = 10,
    PARENTS_MAYBE_UPDATED = 100,
    AUTORUN = 1000,
}

let activeChildAtom: Atom;
let autorunAtoms = new Set();
export class Atom<T = {}> {
    fn: () => T;
    value: Maybe<T>;
    parents: Map<Atom, any>;
    children: Maybe<Set<Atom>>;
    state: AtomState;

    private constructor(fn: Maybe<() => T>, value: Maybe<T>, public name: string) {
        this.fn = fn!;
        this.value = value;
        this.parents = fn === void 0 ? (void 0)! : new Map();
        this.children = void 0;
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

    set(value: T) {
        console.log('set', value, this);
        this.value = value;
        this.setChildrenMaybeState();
        for (const atom of autorunAtoms) {
            atom.autorunCall();
        }
        autorunAtoms.clear();
    }

    setChildrenMaybeState() {
        if (this.children !== void 0) {
            for (const child of this.children) {
                if (child.state === AtomState.AUTORUN) {
                    autorunAtoms.add(child);
                    continue;
                }
                if (child.state !== AtomState.PARENTS_MAYBE_UPDATED) {
                    console.log('setChildrenMaybeState', child);
                    child.state = AtomState.PARENTS_MAYBE_UPDATED;
                    child.setChildrenMaybeState();
                }
            }
        }
    }

    autorunCall() {
        let prevActiveAtom = activeChildAtom;
        activeChildAtom = this;
        for (const [parent, value] of this.parents) {
            parent.children!.delete(this);
        }
        this.parents.clear();
        console.log('autorunCall', this);
        this.fn();
        activeChildAtom = prevActiveAtom;
    }

    recalc() {
        let prevActiveAtom = activeChildAtom;
        activeChildAtom = this;
        for (const [parent, value] of this.parents) {
            parent.children!.delete(this);
        }
        this.parents.clear();
        console.log('recalc', this);
        const newValue = this.fn();
        const hasChanged = newValue !== this.value;
        if (hasChanged) {
            this.setChildrenMaybeState();
        }
        this.value = newValue;
        this.state = AtomState.ACTUAL;
        activeChildAtom = prevActiveAtom;
        return hasChanged;
    }

    needToRecalc() {
        if (this.state === AtomState.PARENTS_MAYBE_UPDATED) {
            if (!this.parents) {
                console.log(this);
            }
            for (const [parent, value] of this.parents) {
                if (parent.needToRecalc() || parent.value !== value) {
                    if (this.recalc()) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    get(): T {
        if ((this.state !== AtomState.ACTUAL && this.needToRecalc()) || this.state === AtomState.NOT_CALLED) {
            this.recalc();
        }
        if (activeChildAtom !== void 0) {
            activeChildAtom.parents.set(this, this.value);
            if (this.children === void 0) {
                this.children = new Set();
            }
            this.children.add(activeChildAtom);
        }
        return this.value!;
    }
}
