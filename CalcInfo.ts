import {FastArray} from './FastArray';
import {heapSort, selectSort} from './Sort';
import {Atom} from './index2';

type TransactionId = number;
let calcInfoTrId = 0;

export class CalcInfo {
    addedParents = new FastArray<Atom>();
    changes = new Uint32Array(1000);
    changesCount = 0;
    transactionId: TransactionId = 0;

    init() {
        this.changesCount = 0;
        this.addedParents.length = 0;
        calcInfoTrId++;
        this.transactionId = calcInfoTrId;
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