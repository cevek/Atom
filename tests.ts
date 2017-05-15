import {Atom} from './index';

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
    console.time('perf');
    console.profile('perfx');

    var r;
    for (var i = 0; i < 1e6; i++) {
        seed.set(i);
        r = i === -1 ? 0 : d.get();
    }
    console.timeEnd('perf');
    console.profileEnd('perfx');
    return r;
}
fast();
// console.log(d.get());

