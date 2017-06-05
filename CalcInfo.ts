import {FastArray} from './FastArray';
import {heapSort, selectSort} from './Sort';
import {Atom} from './index2';

type TransactionId = number;
let calcInfoTrId = 0;

export class CalcInfo {
    addedParents = new FastArray<Atom>();
    changes:number[] = [];
    changesCount = 0;
    transactionId: TransactionId = 0;
    oneOfParentsUpdated = false;
    prev: CalcInfo = (void 0)!;
    next: CalcInfo = (void 0)!;

    init(parentsCount: number) {
        this.changesCount = 0;
        this.addedParents.length = 0;
        calcInfoTrId++;
        this.transactionId = calcInfoTrId;
        this.oneOfParentsUpdated = false;
        if (parentsCount >= this.changes.length) {
            this.increaseChangesArray(parentsCount);
        }
    }

    sortAdded() {
        if (this.addedParents.items.length < 50) {
            return selectSort(this.addedParents.items, this.addedParents.length) as Atom[];
        }
        return heapSort(this.addedParents.items, this.addedParents.length) as Atom[];
    }

    increaseChangesArray(count: number) {
        for (let i = this.changes.length; i <= count; i++) {
            this.changes.push(0);
        }
    }

    touch(foundParentPos: number) {
        if (this.changes[foundParentPos] !== this.transactionId) {
            this.changesCount++;
            this.changes[foundParentPos] = this.transactionId;
        }
    }

    addParentIfNonExistent(parent: Atom) {
        '------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------'
        if (this.addedParents.lastIndexOf(parent) === -1) {
            this.addedParents.push(parent);
            return true;
        }
        return false;
    }
}