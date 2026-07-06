// frontend/src/data/mockGraph.js

// This represents our dummy chain of kindness
export const mockGraphData = {
  nodes: [
    { id: 'DELHI-MAX', name: 'Original Helper', val: 5, color: '#34d399' }, // The root (Emerald 400)
    { id: 'PUNE-ROCKY', name: 'Helped by Max', val: 3, color: '#60a5fa' },
    { id: 'MUM-777', name: 'Helped by Max', val: 3, color: '#60a5fa' },
    { id: 'NY-JOHN', name: 'Helped by Rocky', val: 2, color: '#a78bfa' },
    { id: 'LDN-SARAH', name: 'Helped by Rocky', val: 2, color: '#a78bfa' },
    { id: 'BLR-DEV', name: 'Helped by Mum-777', val: 2, color: '#a78bfa' },
    { id: 'TOK-SAM', name: 'Helped by NY-John', val: 1, color: '#f472b6' },
    { id: 'ANON-1', name: 'Anonymous', val: 1, color: '#94a3b8' }, 
  ],
  links: [
    { source: 'DELHI-MAX', target: 'PUNE-ROCKY' },
    { source: 'DELHI-MAX', target: 'MUM-777' },
    { source: 'PUNE-ROCKY', target: 'NY-JOHN' },
    { source: 'PUNE-ROCKY', target: 'LDN-SARAH' },
    { source: 'MUM-777', target: 'BLR-DEV' },
    { source: 'NY-JOHN', target: 'TOK-SAM' },
    { source: 'BLR-DEV', target: 'ANON-1' } // Dev helped someone who didn't want a K-Tag
  ]
};