export const linearAlgebraSource = String.raw`---
version: "1.0"
title: "Seeing through linear transformations"
description: "Vectors, matrices, and eigenvectors as a language for geometry."
subject: "Linear algebra"
author: "LearnMD"
tags: [vectors, matrices, geometry, eigenvectors]
---

A matrix is often introduced as a rectangle of numbers. That description is correct and almost completely misses the point. A matrix can represent an action: stretching space, rotating a plane, projecting onto a line, or changing the language in which a vector is described.

This chapter develops the geometric meaning behind matrix multiplication. Once that meaning is in place, determinants and eigenvectors become answers to natural questions.

:::prerequisites{title="What to bring"}
You will use pairs of real numbers, basic algebra, and the idea of a function. Read a column vector as a displacement: how far to move horizontally, then how far vertically.
:::

## A vector is more than its coordinates

In the standard basis, the vector $\mathbf v=(3,2)^T$ means three units in the direction of $\mathbf e_1=(1,0)^T$ and two in the direction of $\mathbf e_2=(0,1)^T$:

$$
\mathbf v=3\mathbf e_1+2\mathbf e_2.
$$

The coordinates tell us how to build the vector from the chosen basis. Change the basis and the coordinate numbers may change, even though the geometric vector stays the same. This distinction becomes essential in computer graphics, physics, and numerical computation.

:::definition{title="A linear transformation" id="linear-map"}
A map $T:\mathbb R^n\to\mathbb R^m$ is linear when it preserves addition and scalar multiplication:

$$
T(\mathbf u+\mathbf v)=T(\mathbf u)+T(\mathbf v),\qquad T(c\mathbf v)=cT(\mathbf v).
$$

Equivalently, $T(a\mathbf u+b\mathbf v)=aT(\mathbf u)+bT(\mathbf v)$ for every choice of vectors and scalars.
:::

Linearity has an immediate consequence: $T(\mathbf0)=\mathbf0$. A translation that shifts every point two units to the right is therefore not a linear transformation of the plane. It is an affine transformation, a useful but different kind of map.

## The columns tell the whole story

Suppose a transformation sends the two standard basis vectors to

$$
T(\mathbf e_1)=\begin{pmatrix}2\\1\end{pmatrix},\qquad T(\mathbf e_2)=\begin{pmatrix}1\\2\end{pmatrix}.
$$

Because the map is linear, we already know what it does to every vector. We package those two images as the columns of a matrix:

$$
A=\begin{pmatrix}2&1\\1&2\end{pmatrix}.
$$

::::derivation{title="Transforming a vector using the basis"}
:::step{title="Decompose the input"}
$$
\begin{pmatrix}3\\2\end{pmatrix}=3\mathbf e_1+2\mathbf e_2.
$$
Coordinates are coefficients in a linear combination of basis vectors.
:::
:::step{title="Apply linearity"}
$$
T(3\mathbf e_1+2\mathbf e_2)=3T(\mathbf e_1)+2T(\mathbf e_2).
$$
We only need to know how the basis vectors move.
:::
:::step{title="Combine the columns"}
$$
A\begin{pmatrix}3\\2\end{pmatrix}=3\begin{pmatrix}2\\1\end{pmatrix}+2\begin{pmatrix}1\\2\end{pmatrix}=\begin{pmatrix}8\\7\end{pmatrix}.
$$
Matrix-vector multiplication is a weighted sum of the matrix columns.
:::
::::

:::intuition{title="Imagine a grid moving"}
A linear transformation carries the origin to itself and sends straight grid lines to straight lines. Some directions may stretch, shrink, rotate, reflect, or collapse. The images of the basis vectors determine what happens to the entire grid.
:::

## Composition explains matrix multiplication

Let $B$ act first and $A$ act second. Then the combined transformation is $\mathbf v\mapsto A(B\mathbf v)$, represented by $AB$. The rightmost matrix acts first, just as the inner function acts first in $f(g(x))$.

Order matters. Rotating a plane and then stretching it horizontally usually gives a different result from stretching it horizontally and then rotating it. In symbols, $AB$ need not equal $BA$.

::::tabs{title="A concrete order-of-operations check"}
:::tab{title="Rotate, then stretch"}
Let $R=\begin{pmatrix}0&-1\\1&0\end{pmatrix}$ rotate by $90^\circ$ counterclockwise and $S=\begin{pmatrix}2&0\\0&1\end{pmatrix}$ stretch horizontally. Starting at $(1,0)^T$, rotation gives $(0,1)^T$ and the stretch leaves it unchanged. Thus $SR\mathbf e_1=(0,1)^T$.
:::
:::tab{title="Stretch, then rotate"}
The horizontal stretch sends $(1,0)^T$ to $(2,0)^T$. The rotation then sends it to $(0,2)^T$. Thus $RS\mathbf e_1=(0,2)^T$, so the two compositions differ.
:::
::::

## Determinants measure area and orientation

The unit square is spanned by $\mathbf e_1$ and $\mathbf e_2$. After applying $A$, it becomes a parallelogram spanned by the columns of $A$. Its area is the absolute value of the determinant.

:::formula{title="The two-dimensional determinant" id="determinant"}
$$
\det\begin{pmatrix}a&b\\c&d\end{pmatrix}=ad-bc.
$$
:::

For our matrix, $\det A=4-1=3$. Every region's area is multiplied by $3$. The positive sign means orientation is preserved; a negative determinant would indicate a reversal of orientation.

If the determinant is zero, the image of the unit square has no area. The transformation collapses the plane into a line or a point. Distinct input vectors can then produce the same output, and an inverse cannot recover the original input uniquely.

:::counterexample{title="Two independent-looking columns can still collapse space"}
For $C=\begin{pmatrix}1&2\\2&4\end{pmatrix}$, the second column is twice the first. Every output lies along $(1,2)^T$, and $C(-2,1)^T=\mathbf0$. The nonzero vector $(-2,1)^T$ belongs to the kernel, the set of vectors mapped to zero.
:::

## Eigenvectors: directions that keep their identity

Most vectors change direction under a transformation. Some special vectors remain on their original line. They may stretch, shrink, reverse direction, or stay fixed.

:::definition{title="Eigenvector and eigenvalue" id="eigenvector"}
A nonzero vector $\mathbf v$ is an eigenvector of $A$ if

$$
A\mathbf v=\lambda\mathbf v
$$

for some scalar $\lambda$, called its eigenvalue. The zero vector is excluded because it would satisfy the equation for every scalar.
:::

For $A=\begin{pmatrix}2&1\\1&2\end{pmatrix}$, two directions stand out:

$$
A\begin{pmatrix}1\\1\end{pmatrix}=3\begin{pmatrix}1\\1\end{pmatrix},\qquad A\begin{pmatrix}1\\-1\end{pmatrix}=\begin{pmatrix}1\\-1\end{pmatrix}.
$$

Along one diagonal, space stretches by a factor of $3$. Along the other, it remains unchanged. In a basis built from those directions, this transformation is simply diagonal scaling. Its determinant $3$ is the product of those two scale factors.

::::layers{title="Why eigenvectors are useful"}
:::layer{title="Geometry"}
Eigenvectors reveal the directions in which a transformation has the simplest possible behavior: multiplication by a scalar.
:::
:::layer{title="Repeated transformations"}
If $A\mathbf v=\lambda\mathbf v$, then $A^k\mathbf v=\lambda^k\mathbf v$. Repeated matrix multiplication becomes repeated scalar multiplication along that direction.
:::
:::layer{title="Changing coordinates"}
When an $n\times n$ matrix has a basis of eigenvectors, place them in the columns of an invertible matrix $P$. Then $A=PDP^{-1}$, with eigenvalues on the diagonal of $D$, and $A^k=PD^kP^{-1}$. Not every matrix has enough independent eigenvectors for this construction.
:::
::::

:::warning{title="Not every real matrix has real eigenvectors"}
A rotation of the plane by $90^\circ$ has no real eigenvector: no nonzero real vector stays on its original line. Complex numbers extend the theory, but they do not make that real geometric statement false.
:::

## Put the picture to work

::::match{title="Connect the algebra to the geometry"}
:::pair{left="Matrix column" right="Image of a basis vector"}
:::
:::pair{left="Zero determinant" right="Space collapses into fewer dimensions"}
:::
:::pair{left="Eigenvector" right="A direction preserved as a line"}
:::
:::pair{left="Matrix product AB" right="Apply B first, then A"}
:::
::::

:::question{title="Can you predict the tenth power?" prompt="Apply our matrix A ten times to the vector (1, −1). Where does it end up?"}
It is still $(1,-1)^T$. This vector has eigenvalue $1$, so each application of $A$ leaves it unchanged. No tenfold matrix multiplication is necessary.
:::

:::summary{title="A geometric vocabulary"}
Coordinates describe a vector relative to a basis. A matrix records where a linear map sends that basis. Matrix multiplication represents composition, a determinant records signed volume scaling, and eigenvectors expose directions where the action becomes scalar multiplication. Each calculation is easier to remember when it answers a geometric question.
:::
`;
