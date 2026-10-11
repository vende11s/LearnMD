export const algorithmsSource = String.raw`---
version: "1.0"
title: "The quiet power of binary search"
description: "An invariant-first guide to an algorithm that is simple to state and subtle to get right."
subject: "Computer science"
author: "LearnMD"
tags: [algorithms, binary-search, correctness, complexity]
---

Binary search is usually summarized as “keep cutting the search space in half.” That is the memorable part. The difficult part is deciding precisely what remains possible after each cut.

We will build a useful version of binary search from a clear contract, prove why it works, and connect the same idea to problems that do not look like searching a list at all.

## Start with a precise question

Given a sorted array and a target, we want the position of the **first element greater than or equal to the target**. This is often called a lower bound. If every element is smaller, the answer is the array's length.

For $[2,4,4,7,11]$ and target $4$, the answer is index $1$. For target $6$, the answer is index $3$: the position where inserting $6$ would preserve sorted order. For target $20$, the answer is index $5$.

:::definition{title="The lower-bound contract" id="lower-bound"}
Return an index $p$ with $0\le p\le n$ such that every array element before $p$ is less than the target, and every array element from $p$ onward is greater than or equal to it. The input must be sorted in nondecreasing order under the same comparison used by the search.
:::

This contract handles duplicates, missing values, and empty arrays without special meanings for “not found.” If you need an exact match, first compute $p$, then check that $p<n$ and the element at $p$ equals the target.

## The invariant is the algorithm's memory

Use a half-open interval $[lo,hi)$. The interval contains the elements whose relationship to the boundary is still unknown. At every iteration, maintain:

- Every index smaller than $lo$ contains a value less than the target.
- Every index at least $hi$ contains a value greater than or equal to the target.
- $0\le lo\le hi\le n$.

The answer remains in the closed range $[lo,hi]$ of possible boundary positions. Initially $lo=0$ and $hi=n$, so both known regions are empty. The invariant holds without inspecting any elements.

::::code-walkthrough{title="A lower bound in TypeScript"}
~~~typescript
function lowerBound(values: readonly number[], target: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (values[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}
~~~

:::step{title="Begin with no classified elements" lines="2-3"}
The unknown interval initially covers the entire array. The endpoint at the array length is allowed as an answer but is never read as an element.
:::
:::step{title="Inspect the midpoint" lines="4-5"}
When $lo<hi$, the midpoint satisfies $lo\le mid<hi$, so the array access is in bounds. The subtraction-first form also avoids adding two large indices in languages with bounded integer types.
:::
:::step{title="Discard a proven region" lines="6-9"}
If the midpoint is too small, sorted order proves everything through it is too small, so advance to $mid+1$. Otherwise the midpoint may be the first qualifying element, so preserve it as a possible boundary by setting $hi=mid$.
:::
:::step{title="Return the unique remaining boundary" lines="12"}
At termination, $lo=hi$. The invariant classifies all indices before and after this boundary, exactly matching our contract.
:::
::::

:::warning{title="A comparison must be well behaved"}
This numeric example assumes ordinary finite numbers. JavaScript's NaN does not obey the usual ordering comparisons. If NaN can appear, define a consistent ordering and use it both when sorting and searching. “Sorted” is meaningful only relative to a comparison.
:::

## Follow a complete execution

Search for $4$ in $[2,4,4,7,11]$. Notice how an equal midpoint narrows the search toward the left instead of returning immediately. That is what guarantees the first duplicate.

::::steps{title="Finding the first 4"}
:::step{title="Interval [0, 5)"}
The midpoint is $2$, and the value is $4$. It qualifies, but an earlier $4$ may exist. Set $hi=2$.
:::
:::step{title="Interval [0, 2)"}
The midpoint is $1$, and the value is again $4$. Set $hi=1$ to keep looking left.
:::
:::step{title="Interval [0, 1)"}
The midpoint is $0$, and the value is $2$. This element is too small. Set $lo=1$.
:::
:::step{title="Interval [1, 1)"}
The interval is empty, so stop. Return index $1$, the boundary between values less than $4$ and values at least $4$.
:::
::::

## Why it always finishes

A proof of correctness has two obligations. **Partial correctness** says the result is right if the algorithm finishes. **Termination** says the algorithm really does finish.

:::proof{title="Correctness in three short steps"}
Initialization: with $lo=0$ and $hi=n$, the invariant holds because both classified regions are empty.

Preservation: if the midpoint is below the target, sorted order proves every earlier element is also below it, so moving $lo$ is safe. Otherwise every element at or after the midpoint qualifies, so moving $hi$ is safe.

Termination: each iteration strictly reduces the nonnegative integer $hi-lo$. When it becomes zero, the invariant proves that the returned boundary satisfies the lower-bound contract.
:::

:::counterexample{title="One character can break termination"}
Replacing $lo=mid+1$ with $lo=mid$ can leave the interval unchanged. If $lo=0$, $hi=1$, and the only value is smaller than the target, then $mid=0$ and $lo$ remains zero forever. Whenever you write a loop, identify a quantity that must make progress.
:::

## Why logarithms appear

After each comparison, the unknown interval has at most about half as many elements. After $k$ comparisons, its size is at most approximately $n/2^k$. Solving $n/2^k\approx1$ gives $k\approx\log_2 n$.

An array with roughly one million elements needs only about twenty halvings. This is a statement about comparison count and assumes constant-time access to the midpoint. A linked list does not provide that access, so blindly transferring the array analysis would be misleading.

:::section{title="The cost of maintaining sorted order"}
Binary search makes lookup efficient, but inserting into a contiguous sorted array may still move $O(n)$ elements. If a workload performs many updates, a balanced search tree or another structure may be more appropriate. Analyze the entire workload, including memory locality and update frequency, instead of selecting a data structure from one operation's complexity.
:::

## Beyond arrays: search for a boundary

The deeper pattern is a monotone predicate: false, false, false, then true for the rest of an ordered domain. Binary search finds the transition. An array comparison is just one way to create that predicate.

::::scenario{title="Recognize the boundary"}
:::case{title="Deployment versions"}
If a regression first appears in one release and remains present in all later releases, testing a midpoint release can narrow down the first bad version. The monotonicity assumption must be checked: intermittent failures or later fixes can invalidate it.
:::
:::case{title="Capacity planning"}
Suppose a feasibility test tells you whether a proposed machine capacity can finish a fixed workload by a deadline. If more capacity can never make the schedule infeasible, you can search for the smallest feasible capacity.
:::
:::case{title="A tempting misuse"}
An arbitrary list of test results such as false, true, false, true has no single transition. Binary search cannot find the first true reliably without additional structure. The speed comes from information supplied by monotonicity.
:::
::::

## Test the contract, not just a happy path

Useful cases include an empty array, a single element, all equal elements, a target below everything, a target above everything, and a target between neighbors. For each returned index, verify both halves of the contract.

::::quiz{title="Why set hi = mid when values[mid] equals the target?" explanation="The midpoint is a valid candidate, but a duplicate may occur earlier. Retaining it as the upper boundary preserves the first qualifying position."}
:::choice{correct="false"}
Because equality means the target is absent.
:::
:::choice{correct="true"}
Because the midpoint qualifies, and an earlier qualifying element may still exist.
:::
:::choice{correct="false"}
Because the midpoint should always be excluded from the answer.
:::
::::

:::summary{title="The reusable lesson"}
Begin with a contract. State what is already known outside the search interval. Make every update preserve that knowledge and shrink the unknown region. The logarithmic running time follows from halving; the reliability follows from the invariant.
:::
`;
