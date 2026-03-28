import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

type TreeItem = string | [string, ...TreeItem[]];

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs));
}

/**
 * Convert a record of files to a tree structure.
 * @param files - Record of file paths to content
 * @returns Tree structure for TreeView component
 */
export function convertFilesToTreeItems(
  files: Record<string, string>
): TreeItem[] {
  interface TreeNode {
    [key: string]: TreeNode | null;
  }

  const tree: TreeNode = {};

  // 🔥 Sort paths for consistent UI
  const sortedPaths = Object.keys(files).sort();

  for (const filePath of sortedPaths) {
    if (!filePath) continue;

    const parts = filePath.split("/").filter(Boolean);
    let current: TreeNode = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      // last part → file
      if (i === parts.length - 1) {
        current[part] = null;
      } else {
        if (!current[part] || current[part] === null) {
          current[part] = {};
        }
        current = current[part] as TreeNode;
      }
    }
  }

  // 🔥 Convert tree → TreeItem
  function convertNode(node: TreeNode): TreeItem[] {
    return Object.entries(node).map(([key, value]) => {
      if (value === null) {
        // file
        return key;
      }

      // folder
      return [key, ...convertNode(value)];
    });
  }

  return convertNode(tree);
}