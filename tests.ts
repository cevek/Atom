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
// console.log(d.get());

