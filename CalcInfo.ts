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

    init() {
        this.changesCount = 0;
        this.addedParents.length = 0;
        calcInfoTrId++;
        this.transactionId = calcInfoTrId;
        this.oneOfParentsUpdated = false;
    }

    sortAdded() {
        if (this.addedParents.items.length < 50) {
            return selectSort(this.addedParents.items, this.addedParents.length) as Atom[];
        }
        return heapSort(this.addedParents.items, this.addedParents.length) as Atom[];
    }

    addZeroToChanges(count: number) {
        '------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------';
        for (let i = 0; i <= count; i++) {
            this.changes.push(0);
        }
    }

    touch(foundParentPos: number) {
        if (foundParentPos >= this.changes.length) {
            this.addZeroToChanges(foundParentPos - this.changes.length + 1);
            // for (let i = this.changes.length; i <= foundParentPos; i++) {
                // this.changes.push(0);
            // }
        }
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