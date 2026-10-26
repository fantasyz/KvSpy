import Prism from 'prismjs';

// The prismjs markup component is a plain script that mutates a bare global
// `Prism` — it has no import of its own, so chunk splitting cannot guarantee
// the core initialises first (the core is a lazily-evaluated module while the
// component runs at chunk evaluation). Expose the instance on globalThis and
// load the component via a cross-chunk dynamic import to enforce the order.
(globalThis as { Prism?: typeof Prism }).Prism = Prism;
import('prismjs/components/prism-markup');

export {};
