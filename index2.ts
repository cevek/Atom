import {CalcInfo} from './CalcInfo';
import {FastArray} from './FastArray';

type Maybe<T> = T | undefined;

const enum AtomState {
    ACTUAL = 1,
    CALCULATING = 5,
    PARENTS_MAYBE_UPDATED = 10,
    NOT_CALLED = 100,
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
let autorunsRunnerScheduled = false;
let calcInfo = new CalcInfo();
const firstCalcInfo = calcInfo;
for (let i = 0; i < 500; i++) {
    const nextCalcInfo = new CalcInfo();
    nextCalcInfo.prev = calcInfo;
    calcInfo.next = nextCalcInfo;
    calcInfo = nextCalcInfo;
}
calcInfo = firstCalcInfo.next;

export class Atom<T = {}> {
    id = id++;
    private valueId: ValueId = 0;
    private fn: () => T;
    private value: Maybe<T>;
    private type: AtomType;

    private parentsArr: Maybe<ParentTuple[]> = (void 0)!;
    private childrenArr: Atom[] = (void 0)!;
    private childrenArrLength = 0;

    private state: AtomState;

    private constructor(type: AtomType, fn: Maybe<() => T>, value: Maybe<T>, public name: string) {
        this.type = type;
        this.fn = fn!;
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
        if (this.type !== AtomType.VALUE) {
            throw new Error('You can set only valued atoms');
        }
        if (value !== this.value) {
            this.value = value;
            this.valueId++;
            for (let i = 0; i < this.childrenArrLength; i++) {
                const child = this.childrenArr[i];
                child.setMaybeStateOnlyToActualOrCalculating();
            }
            if (autorunsRunnerScheduled === false) {
                Atom.scheduleAutorunRunner();
            }
        }
    }

    destroy() {
        if (this.parentsArr !== void 0) {
            for (let i = 0; i < this.parentsArr.length; i += 3) {
                const parent = this.parentsArr[i] as Atom;
                parent.removeChild(this);
            }
            this.parentsArr = (void 0)!;
        }
        this.childrenArr = (void 0)!;
        this.childrenArrLength = 0;
        this.state = AtomState.DESTROYED;
        if (this.type === AtomType.AUTORUN) {
            autorunAtoms.removeUniqueItem(this);
        }
    }

    private setMaybeStateOnlyToActual() {
        if (this.state === AtomState.ACTUAL) {
            this.state = AtomState.PARENTS_MAYBE_UPDATED;
            for (let i = 0; i < this.childrenArrLength; i++) {
                const child = this.childrenArr[i];
                child.setMaybeStateOnlyToActual();
            }
        }
    }

    private setMaybeStateOnlyToActualOrCalculating() {
        if (this.state === AtomState.ACTUAL || this.state === AtomState.CALCULATING) {
            this.state = AtomState.PARENTS_MAYBE_UPDATED;
            for (let i = 0; i < this.childrenArrLength; i++) {
                const child = this.childrenArr[i];
                child.setMaybeStateOnlyToActualOrCalculating();
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

    private rebuildParents(calcInfo: CalcInfo) {
        if (calcInfo.addedParents.length === 0) {
            const p = this.parentsArr;
            if (p === void 0) return;
            if (calcInfo.changesCount * 3 === p.length) {
                if (calcInfo.oneOfParentsUpdated) {
                    for (let i = 0; i < p.length; i += 3) {
                        p[i + 1] = (p[i] as Atom).valueId;
                    }
                }
                return;
            }
        }
        this.makeNewParents(calcInfo);
    }

    private makeNewParents(calcInfo: CalcInfo) {
        const newParentsArr: ParentTuple[] = new Array((calcInfo.changesCount + calcInfo.addedParents.length) * 3);
        const addedParents = calcInfo.sortAdded();

        let k = 0;
        let j = 0;
        if (this.parentsArr !== void 0) {
            for (let i = 0; i < this.parentsArr.length; i += 3) {
                const parent = this.parentsArr[i] as Atom;
                if (calcInfo.changes[i] === calcInfo.transactionId) {
                    while (j < addedParents.length) {
                        const nextAddedParent = addedParents[j];
                        if (nextAddedParent.id > parent.id) {
                            break;
                        }
                        newParentsArr[k++] = nextAddedParent;
                        newParentsArr[k++] = nextAddedParent.valueId;
                        newParentsArr[k++] = true;
                        j++;
                    }
                    newParentsArr[k++] = parent;
                    newParentsArr[k++] = parent.valueId;
                    newParentsArr[k++] = true;
                } else {
                    parent.removeChild(this);
                }
            }
        }
        while (j < addedParents.length) {
            const nextAddedParent = addedParents[j];
            newParentsArr[k++] = nextAddedParent;
            newParentsArr[k++] = nextAddedParent.valueId;
            newParentsArr[k++] = true;
            j++;
        }
        this.parentsArr = newParentsArr;
    }


    private recalc() {
        let prev = activeChildAtom;
        activeChildAtom = this;
        calcInfo = calcInfo.next;
        calcInfo.init();
        this.state = AtomState.CALCULATING;
        const newVal = this.fn();
        const changed = newVal !== this.value;
        if (changed) {
            this.valueId++;
            this.value = newVal;
            calcInfo.prev.oneOfParentsUpdated = true;
            if (this.childrenArrLength > 0) {
                for (let i = 0; i < this.childrenArrLength; i++) {
                    const child = this.childrenArr[i];
                    child.setMaybeStateOnlyToActual();
                }
            }
        }
        this.rebuildParents(calcInfo);
        if (this.state === AtomState.CALCULATING) {
            this.state = AtomState.ACTUAL;
        }
        activeChildAtom = prev;
        calcInfo = calcInfo.prev;
        return changed;
    }

    private actualize() {
        switch (this.state) {
            case AtomState.PARENTS_MAYBE_UPDATED:
                if (this.parentsArr !== void 0) {
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
                            this.recalc();
                            return;
                        }
                    }
                }
                this.state = AtomState.ACTUAL;
                return;

            case AtomState.NOT_CALLED:
                this.recalc();
                return;

            case AtomState.DESTROYED:
                return;

            case AtomState.CALCULATING:
                throw new Error('Recursive call: ' + this.name);
        }
    }

    private addChild(atom: Atom) {
        if (this.state === AtomState.DESTROYED) return;
        if (this.childrenArrLength === 0) {
            atomsKnowingOwnChildren.push(this);
        }
        if (this.childrenArr === void 0) {
            this.childrenArr = [atom];
        } else {
            this.childrenArr[this.childrenArrLength] = atom;
        }
        this.childrenArrLength++;
    }

    private clearKnownAboutChildren() {
        for (let i = 0; i < this.childrenArrLength; i++) {
            const child = this.childrenArr[i];
            child.setMaybeStateOnlyToActual();
            if (child.parentsArr !== void 0) {
                for (let j = 2; j < child.parentsArr.length; j += 3) {
                    child.parentsArr[j] = false;
                }
            }
            this.childrenArr[i] = (void 0)!;
        }
        this.childrenArrLength = 0;
    }

    private addParent(parent: Atom) {
        const foundParentPos = this.parentsArr === void 0 ? -1 : this.searchParent(this.parentsArr, parent);
        if (foundParentPos === -1) {
            return calcInfo.addParentIfNonExistent(parent);
        }
        calcInfo.touch(foundParentPos);
        return false;
    }

    private searchParent(parents: ParentTuple[], search: Atom) {
        if (parents.length < 15) {
            return this.simpleSearchParent(parents, search);
        }
        let i, el, min = 0, max = parents.length / 3 - 1;
        while (min <= max) {
            i = (min + max) >> 1;
            el = (parents[i * 3] as Atom).id;
            if (el < search.id) {
                min = i + 1;
            } else if (el > search.id) {
                max = i - 1;
            } else {
                return i;
            }
        }
        return -1;
    }

    private simpleSearchParent(parents: ParentTuple[], search: Atom) {
        for (let i = 0; i < parents.length; i += 3) {
            if (parents[i] === search) {
                return i;
            }
        }
        return -1;
    }

    private static scheduleAutorunRunner() {
        if (autorunsRunnerScheduled === false) {
            autorunsRunnerScheduled = true;
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
        autorunsRunnerScheduled = false;
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
        let calcInfo = firstCalcInfo;
        while (calcInfo !== void 0) {
            calcInfo.addedParents.fullReset();
            calcInfo = calcInfo.next;
        }
    }
}

const timer: any = setInterval(Atom.doGarbageCollection, 60000);
if (typeof timer === 'object' && typeof timer.unref === 'function') {
    timer.unref();
}
