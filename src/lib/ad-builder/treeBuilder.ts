import { FolderNode } from "./types";

export const buildTreeFromUrls = (
  urls: string[],
  siteName: string,
): FolderNode[] => {
  const siteRoot: FolderNode = {
    name: siteName || "Entire Site",
    path: "/",
    depth: 1,
    children: [],
  };

  const rootObj: { [key: string]: any } = {};

  urls.forEach((url) => {
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split("/").filter(Boolean);
      let currentLevel = rootObj;

      segments.forEach((segment, index) => {
        if (!currentLevel[segment]) {
          currentLevel[segment] = {
            _meta: {
              name: segment
                .replace(/-/g, " ")
                .replace(/_/g, " ")
                .replace(/\b\w/g, (l) => l.toUpperCase()),
              path: "/" + segments.slice(0, index + 1).join("/"),
              depth: index + 2,
            },
            _children: {},
          };
        }
        currentLevel = currentLevel[segment]._children;
      });
    } catch {
      console.warn("TreeBuilder: Invalid URL skipped:", url);
    }
  });

  const convertToNodes = (obj: any): FolderNode[] => {
    return Object.keys(obj).map((key) => {
      const nodeData = obj[key];
      return {
        name: nodeData._meta.name,
        path: nodeData._meta.path,
        depth: nodeData._meta.depth,
        children: convertToNodes(nodeData._children),
      };
    });
  };

  siteRoot.children = convertToNodes(rootObj);
  return [siteRoot];
};

export const getStats = (folders: FolderNode[]) => {
  let total = 0;
  let maxDepth = 0;
  const topLevels: string[] = [];

  const traverse = (nodes: FolderNode[]) => {
    nodes.forEach((n) => {
      total++;
      if (n.depth > maxDepth) maxDepth = n.depth;
      if (n.depth === 1) topLevels.push(n.name);
      if (n.children) traverse(n.children);
    });
  };

  traverse(folders);
  return {
    totalFolders: total,
    maxDepth,
    topLevels,
  };
};

export const findNodeByPath = (
  nodes: FolderNode[],
  path: string,
): FolderNode | null => {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children && node.children.length > 0) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return null;
};
