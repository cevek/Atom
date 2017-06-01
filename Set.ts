
function lastIndexOf<T>(arr: T[], value: T) {
    for (let i = arr.length - 1; i >= 0; i--) {
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
    for (let i = pos; i < arr.length - 1; i++) {
        arr[i] = arr[i + 1];
    }
    arr.pop();
    return arr;
}

function insertItem<T>(arr: T[], pos: number, value: T) {
    arr.push(null!);
    for (let i = arr.length - 1; i > pos; i--) {
        arr[i] = arr[i - 1];
    }
    arr[pos] = value;
    return arr;
}