const sourceSelector = '[data-source-start][data-source-end]';
const directiveSelector = `${sourceSelector}[data-source-kind="directive"]`;

function sourceElement(node: Node, root: HTMLElement) {
  const element = node instanceof Element ? node : node.parentElement;
  const block =
    element?.closest(directiveSelector) ?? element?.closest(sourceSelector);
  return block && root.contains(block) ? block : null;
}

function offsets(element: Element): [number, number] {
  return [
    Number(element.getAttribute('data-source-start')),
    Number(element.getAttribute('data-source-end')),
  ];
}

/** Copy complete authored blocks, never UI labels or rendered math text. */
export function sourceForSelection(
  root: HTMLElement,
  selection: Selection,
  source: string,
): string | null {
  if (
    selection.isCollapsed ||
    selection.rangeCount !== 1 ||
    !selection.toString().trim()
  )
    return null;
  const range = selection.getRangeAt(0);
  if (
    !root.contains(range.startContainer) ||
    !root.contains(range.endContainer)
  )
    return null;
  const first = sourceElement(range.startContainer, root);
  const last = sourceElement(range.endContainer, root);
  if (!first || !last) return null;
  let start = Math.min(offsets(first)[0], offsets(last)[0]);
  let end = Math.max(offsets(first)[1], offsets(last)[1]);
  // If a selection crosses a container boundary, include both fences of that
  // container. A selection within one nested quiz still copies only that quiz.
  for (const edge of [first, last]) {
    let parent = edge.parentElement?.closest(directiveSelector);
    while (parent && root.contains(parent)) {
      const [outerStart, outerEnd] = offsets(parent);
      if (start < outerStart || end > outerEnd) {
        start = Math.min(start, outerStart);
        end = Math.max(end, outerEnd);
      }
      parent = parent.parentElement?.closest(directiveSelector);
    }
  }
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    end > source.length
  )
    return null;
  return source.slice(start, end);
}
