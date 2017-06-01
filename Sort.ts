export type SortArrWithId = {[n: number]: {id: number}};

export function heapSort(array: SortArrWithId, length: number) {
    let size = length;
    let temp;
    buildMaxHeap(array, length);
    for (let i = length - 1; i > 0; i -= 1) {
        temp = array[0];
        array[0] = array[i];
        array[i] = temp;
        size -= 1;
        heapify(array, 0, size);
    }
    return array;
}

export function selectSort(arr: SortArrWithId, length: number) {
    let min, tmp;
    for (let i = 0; i < length; i++) {
        min = i;
        for (let j = i + 1; j < length; j++) {
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


function heapify(array: SortArrWithId, index: number, heapSize: number) {
    let left = (index << 1) + 1,
        right = (index << 1) + 2,
        largest = index;

    if (left < heapSize && array[left].id > array[index].id)
        largest = left;

    if (right < heapSize && array[right].id > array[largest].id)
        largest = right;

    if (largest !== index) {
        let temp = array[index];
        array[index] = array[largest];
        array[largest] = temp;
        heapify(array, largest, heapSize);
    }
}

function buildMaxHeap(array: SortArrWithId, length: number) {
    for (let i = length >> 1; i >= 0; i -= 1) {
        heapify(array, i, length);
    }
    return array;
}