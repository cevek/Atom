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
export class Atom<T = {}> {
    id = id++;
    fn: () => T;
    value: Maybe<T>;

    parentsArr: any[];
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
                    autorunAtoms.add(child);
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

    recalc() {
        let prevActiveAtom = activeChildAtom;
        activeChildAtom = this;
        this.clearParents();
        // console.log('recalc', this);
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
            for (var i = 0; i < this.parentsArr.length; i += 2) {
                const parent = this.parentsArr[i];
                const value = this.parentsArr[i + 1];
                if (parent.needToRecalc() || parent.value !== value) {
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
        var found = false;
        for (var i = 0; i < this.childrenArr.length; i++) {
            const child = this.childrenArr[i];
            if (atom === child) {
                found = true;
                break;
            }
        }
        if (found === false) {
            this.childrenArr.push(atom);
        }
    }

    addParent(atom: Atom) {
        var foundParent = false;
        for (var i = 0; i < this.parentsArr.length; i += 2) {
            const parent = this.parentsArr[i];
            if (parent === atom) {
                foundParent = true;
                break;
            }
        }
        if (foundParent === false) {
            this.parentsArr.push(atom, atom.value);
        }
    }

    get(): T {
        if ((this.state === AtomState.PARENTS_MAYBE_UPDATED && this.needToRecalc()) || this.state === AtomState.NOT_CALLED) {
            this.recalc();
        }
        if (activeChildAtom !== void 0) {
            activeChildAtom.addParent(this);
            this.addChild(activeChildAtom);
        }
        return this.value!;
    }
}

