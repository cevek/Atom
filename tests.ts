import {Atom} from './index2';

const seed = Atom.value(1, 'seed');
const b = Atom.calc(() => {
    return seed.get() + 10;
}, 'b');
const c = Atom.calc(() => {
    b.get();
    return 5;
}, 'c');
const d = Atom.calc(() => {
    return c.get();
}, 'd');

Atom.autorun(() => {
    return d.get();
}, 'autorun');


declare const global:any;
global.seed = seed;
global.b = b;
global.c = c;
global.d = d;

console.log(d.get());
seed.set(2);
seed.set(3);


d.get();

declare const console:any;
if (!console.profile) {
    console.profile = console.time;
    console.profileEnd = console.timeEnd;
}

function fast() {
    for (var i = 0; i < 1e6; i++) {
        seed.set(i);
        d.get();
    }
}
console.time('perf');
console.profile('perfx');
fast();
console.timeEnd('perf');
console.profileEnd('perfx');
debugger;
// console.log(d.get());

