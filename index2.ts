import {Pool} from './Pool';
import {CalcInfo} from './CalcInfo';
import {FastArray} from './FastArray';

type Maybe<T> = T | undefined;

const enum AtomState {
    ACTUAL = 1,
    NOT_CALLED = 10,
    PARENTS_MAYBE_UPDATED = 100,
    DESTROYED = 1000,
}

const enum AtomType {
    VALUE = 1,
    CALC = 10,
    AUTORUN = 100,
}

type ValueId = number;
type ParentTuple = Atom | ValueId | boolean;


let id = 0;
let activeChildAtom: Atom;
const autorunAtoms = new FastArray<Atom>();
const atomsKnowingOwnChildren = new FastArray<Atom>();
const calcInfoPool = new Pool(() => new CalcInfo());


export class Atom<T = {}> {
    id = id++;
    private valueId: ValueId = 0;
    private fn: () => T;
    private value: Maybe<T>;
    private type: AtomType;

    private calcInfo: CalcInfo;
    private parentsArr: ParentTuple[];
    private childrenArr: Atom[];
    private childrenArrLength = 0;

    private state: AtomState;

    private constructor(type: AtomType, fn: Maybe<() => T>, value: Maybe<T>, public name: string) {
        this.type = type;
        this.fn = fn!;
        this.value = value;
        this.parentsArr = fn === void 0 ? (void 0)! : [];
        this.childrenArr = (void 0)!;
        this.value = value;
        this.state = fn === void 0 ? AtomState.ACTUAL : AtomState.NOT_CALLED;
    }

    static value<T>(value: T, name: string) {
        return new Atom(AtomType.VALUE, void 0, value, name);
    }

    static calc<T>(fn: () => T, name: string) {
        return new Atom(AtomType.CALC, fn, void 0, name);
    }

    static autorun<T>(fn: () => T, name: string) {
        const atom = new Atom(AtomType.AUTORUN, fn, void 0, name);
        autorunAtoms.push(atom);
        return atom;
    }

    get(): T {
        if (this.state !== AtomState.ACTUAL) {
            this.actualize();
        }
        if (activeChildAtom !== void 0) {
            if (activeChildAtom.addParent(this)) {
                this.addChild(activeChildAtom);
            }
        }
        return this.value!;
    }

    set(value: T) {
        if (value !== this.value) {
            this.value = value;
            this.valueId++;
            this.setChildrenMaybeState();
            Atom.scheduleAutorunRunner();
        }
    }

    destroy() {
        for (let i = 0; i < this.parentsArr.length; i += 3) {
            const parent = this.parentsArr[i] as Atom;
            parent.removeChild(this);
        }
        this.parentsArr = (void 0)!;
        this.childrenArr = (void 0)!;
        this.childrenArrLength = 0;
        this.state = AtomState.DESTROYED;
        if (this.type === AtomType.AUTORUN) {
            autorunAtoms.removeUniqueItem(this);
        }
    }

    private setChildrenMaybeState() {
        for (let i = 0; i < this.childrenArrLength; i++) {
            const child = this.childrenArr[i];
            if (child.state === AtomState.ACTUAL) {
                child.state = AtomState.PARENTS_MAYBE_UPDATED;
                child.setChildrenMaybeState();
            }
        }
    }

    private removeChild(child: Atom) {
        for (let i = 0; i < this.childrenArrLength; i++) {
            if (this.childrenArr[i] === child) {
                for (let j = i; j < this.childrenArrLength - 1; j++) {
                    this.childrenArr[j] = this.childrenArr[j + 1];
                }
                this.childrenArrLength--;
                this.childrenArr[this.childrenArrLength] = (void 0)!;
                return;
            }
        }
    }

    private rebuildParents() {
        if (this.calcInfo.changesCount === this.parentsArr.length && this.calcInfo.addedParents.length === 0) {
            return this.parentsArr;
        }
        const newParentsArr: ParentTuple[] = new Array((this.calcInfo.changesCount + this.calcInfo.addedParents.length) * 3);
        const addedParents = this.calcInfo.sortAdded();

        let j = 0;
        for (let i = 0; i < this.parentsArr.length; i += 3) {
            const parent = this.parentsArr[i] as Atom;
            if (this.calcInfo.changes[i] === this.calcInfo.transactionId) {
                while (j < addedParents.length) {
                    const nextAddedParent = addedParents[j];
                    if (nextAddedParent.id > parent.id) {
                        break;
                    }
                    newParentsArr.push(nextAddedParent, nextAddedParent.valueId, true);
                    j++;
                }
                newParentsArr.push(parent, parent.valueId, true);
            } else {
                parent.removeChild(this);
            }
        }
        return newParentsArr;
    }

    private recalc() {
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

    private actualize() {
        switch (this.state) {
            case AtomState.PARENTS_MAYBE_UPDATED:
                for (let i = 0; i < this.parentsArr.length; i += 3) {
                    const parent = this.parentsArr[i] as Atom;
                    const valueId = this.parentsArr[i + 1] as ValueId;
                    const parentKnowMe = this.parentsArr[i + 2] as boolean;
                    if (parent.state !== AtomState.ACTUAL) {
                        parent.actualize();
                    }
                    if (parentKnowMe === false) {
                        parent.addChild(this);
                    }
                    if (parent.valueId !== valueId) {
                        return this.recalc();
                    }
                }
                this.state = AtomState.ACTUAL;
                return false;

            case AtomState.NOT_CALLED:
                return this.recalc();

            case AtomState.DESTROYED:
                return false;
        }
        return false;
    }

    private addChild(atom: Atom) {
        if (this.state === AtomState.DESTROYED) return;
        if (this.childrenArrLength === 0) {
            atomsKnowingOwnChildren.push(this);
        }
        if (this.childrenArr === void 0) {
            this.childrenArr = [];
        }
        this.childrenArr[this.childrenArrLength++] = atom;
    }

    private clearKnownAboutChildren() {
        for (let i = 0; i < this.childrenArrLength; i++) {
            const child = this.childrenArr[i];
            for (let j = 2; j < child.parentsArr.length; j += 3) {
                child.parentsArr[j] = false;
            }
            this.childrenArr[i] = (void 0)!;
        }
        this.childrenArrLength = 0;
    }

    private addParent(parent: Atom) {
        const foundParentPos = this.searchParent(parent);
        if (foundParentPos === -1) {
            return this.calcInfo.addParentIfNonExistent(parent);
        } else {
            this.calcInfo.touch(foundParentPos);
            return true;
        }
    }

    private searchParent(search: Atom) {
        let minI = 0;
        let maxI = this.parentsArr.length / 3;
        let curI, curEl;
        while (minI <= maxI) {
            curI = (minI + maxI) >> 1;
            curEl = (this.parentsArr[curI * 3] as Atom).id;
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

    private static autorunsRunnerScheduled = false;

    private static scheduleAutorunRunner() {
        if (Atom.autorunsRunnerScheduled === false) {
            Atom.autorunsRunnerScheduled = true;
            setTimeout(Atom.runAutoruns, 0);
        }
    }

    private static runAutoruns() {
        for (let i = 0; i < autorunAtoms.length; i++) {
            const atom = autorunAtoms.items[i];
            if (atom.state !== AtomState.ACTUAL) {
                atom.actualize();
            }
        }
        Atom.autorunsRunnerScheduled = false;
    }

    static doGarbageCollection() {
        if (atomsKnowingOwnChildren.length > 0) {
            for (let i = 0; i < atomsKnowingOwnChildren.length; i++) {
                const atom = atomsKnowingOwnChildren.items[i];
                atomsKnowingOwnChildren.items[i] = (void 0)!;
                atom.clearKnownAboutChildren();
            }
            atomsKnowingOwnChildren.reset();
        }
        for (let i = 0; i < calcInfoPool.cache.length; i++) {
            const calcInfo = calcInfoPool.cache[i];
            calcInfo.addedParents.fullReset();
        }
    }
}

const timer: any = setInterval(Atom.doGarbageCollection, 60);
if (typeof timer === 'object' && typeof timer.unref === 'function') {
    timer.unref();
}
