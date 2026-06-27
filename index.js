const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());


const USER_ID             = "YudhiAngra_20052005";   
const EMAIL_ID            = "yudhi1086@chitkara.edu.in"; 
const COLLEGE_ROLL_NUMBER = "2310991086";            

function parseEntry(raw) {
  const entry = raw.trim();
  if (!/^[A-Z]->[A-Z]$/.test(entry)) return null;
  if (entry[0] === entry[3]) return null; // self-loop
  return entry;
}

function hasCycle(nodes, adjList) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};
  for (const n of nodes) color[n] = WHITE;
  function dfs(u) {
    color[u] = GRAY;
    for (const v of (adjList[u] || [])) {
      if (color[v] === GRAY) return true;
      if (color[v] === WHITE && dfs(v)) return true;
    }
    color[u] = BLACK;
    return false;
  }
  for (const n of nodes) {
    if (color[n] === WHITE && dfs(n)) return true;
  }
  return false;
}

function buildTree(node, adjList, visited = new Set()) {
  if (visited.has(node)) return {};
  visited.add(node);
  const obj = {};
  for (const child of (adjList[node] || [])) {
    obj[child] = buildTree(child, adjList, visited);
  }
  return obj;
}

function calcDepth(node, adjList, memo = {}) {
  if (node in memo) return memo[node];
  const children = adjList[node] || [];
  if (children.length === 0) return (memo[node] = 1);
  return (memo[node] = 1 + Math.max(...children.map(c => calcDepth(c, adjList, memo))));
}

function processData(data) {
  const invalid_entries = [];
  const duplicate_edges = [];
  const seenEdges = new Set();
  const validEdges = [];

  for (const raw of data) {
    const entry = parseEntry(raw);
    if (!entry) {
      invalid_entries.push(raw.trim());
      continue;
    }
    if (seenEdges.has(entry)) {
      if (!duplicate_edges.includes(entry)) duplicate_edges.push(entry);
      continue;
    }
    seenEdges.add(entry);
    validEdges.push([entry[0], entry[3]]);
  }

  // Build adjacency list (first-parent-wins for diamonds)
  const adjList = {};
  const childParentMap = {};
  for (const [p, c] of validEdges) {
    if (c in childParentMap) continue;
    childParentMap[c] = p;
    if (!adjList[p]) adjList[p] = [];
    adjList[p].push(c);
  }

  // Collect all nodes
  const allNodes = new Set();
  for (const [p, c] of validEdges) { allNodes.add(p); allNodes.add(c); }

  // Find connected components via BFS
  const visited = new Set();
  const components = [];
  function bfsComponent(start) {
    const queue = [start], comp = new Set();
    while (queue.length) {
      const n = queue.shift();
      if (comp.has(n)) continue;
      comp.add(n);
      for (const ch of (adjList[n] || [])) if (!comp.has(ch)) queue.push(ch);
      if (childParentMap[n] && !comp.has(childParentMap[n])) queue.push(childParentMap[n]);
    }
    return comp;
  }
  for (const node of allNodes) {
    if (!visited.has(node)) {
      const comp = bfsComponent(node);
      for (const n of comp) visited.add(n);
      components.push(comp);
    }
  }

  // Build hierarchy for each component
  const hierarchies = [];
  for (const comp of components) {
    const nodes = [...comp];
    const childSet = new Set(Object.keys(childParentMap).filter(c => comp.has(c)));
    const roots = nodes.filter(n => !childSet.has(n));
    const isCyclic = hasCycle(nodes, adjList);
    const root = roots.length > 0 ? roots.sort()[0] : nodes.sort()[0];

    if (isCyclic) {
      hierarchies.push({ root, tree: {}, has_cycle: true });
    } else {
      const tree = { [root]: buildTree(root, adjList) };
      const depth = calcDepth(root, adjList);
      hierarchies.push({ root, tree, depth });
    }
  }

  const nonCyclic = hierarchies.filter(h => !h.has_cycle);
  const cyclic    = hierarchies.filter(h =>  h.has_cycle);

  let largest_tree_root = "";
  if (nonCyclic.length > 0) {
    const sorted = [...nonCyclic].sort((a, b) =>
      b.depth - a.depth || a.root.localeCompare(b.root)
    );
    largest_tree_root = sorted[0].root;
  }

  return {
    user_id: USER_ID,
    email_id: EMAIL_ID,
    college_roll_number: COLLEGE_ROLL_NUMBER,
    hierarchies,
    invalid_entries,
    duplicate_edges,
    summary: {
      total_trees: nonCyclic.length,
      total_cycles: cyclic.length,
      largest_tree_root,
    },
  };
}

app.post("/bfhl", (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: "'data' must be an array." });
    }
    res.json(processData(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));