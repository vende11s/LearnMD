export const calculusSource = String.raw`---
version: "1.0"
title: "The art of understanding change"
description: "A thoughtful introduction to derivatives, from a moving point to the shape of a function."
subject: "Calculus"
author: "LearnMD"
tags: [calculus, derivatives, limits]
---

A car moves. A population grows. A curve bends. Calculus begins with a deceptively simple question: **how quickly is something changing, right now?**

The challenge is hidden in those last two words. Average change takes place over an interval. An instantaneous rate belongs to a single moment. The derivative is the bridge between them.

:::prerequisites{title="Before you begin"}
You should be comfortable with functions, algebraic expansion, and the idea of a limit. You do not need to know differentiation rules yet. Keep a pencil nearby: predicting the next step matters more than memorizing the result.
:::

## From a journey to a single moment

Imagine a cyclist whose distance from the start is modeled by $s(t)=t^2$ meters, where $t$ is measured in seconds. Between $t=2$ and $t=4$, the cyclist travels $16-4=12$ meters in $2$ seconds. The average velocity is $6$ meters per second.

But that single number compresses a changing journey. The cyclist is speeding up. To investigate the velocity at $t=2$, we need to look at shorter intervals beginning there.

| Interval | Distance traveled | Average velocity |
| --- | --- | --- |
| $2$ to $3$ | $9-4=5$ m | $5$ m/s |
| $2$ to $2.5$ | $6.25-4=2.25$ m | $4.5$ m/s |
| $2$ to $2.1$ | $4.41-4=0.41$ m | $4.1$ m/s |
| $2$ to $2.01$ | $4.0401-4=0.0401$ m | $4.01$ m/s |

The averages approach $4$. We have not measured motion over an interval of zero length; that would divide by zero. We have identified what the rates approach as the interval becomes arbitrarily small.

:::intuition{title="A closer view"}
Picture zooming in on a smooth curve. As your field of view shrinks around one point, the curve looks increasingly like a straight line. The derivative records that line's slope. This is why a curved motion can have a precise instantaneous velocity.
:::

## Defining the derivative

:::definition{title="Derivative at a point" id="derivative-definition"}
The derivative of $f$ at $a$ is the finite limit

$$
f'(a)=\lim_{h\to 0}\frac{f(a+h)-f(a)}{h},
$$

provided the same limit is reached from both sides. The numerator measures a change in output; the denominator measures the corresponding change in input.
:::

The expression inside the limit is a **difference quotient**. Geometrically it gives the slope of a secant line through two points on the graph. When its limit exists, the secants approach a tangent line.

Notice the units. If $f$ is a distance in meters and its input is time in seconds, then $f'$ is measured in meters per second. A derivative is a rate, so its units are always output units divided by input units.

::::layers{title="Three ways to understand the same idea"}
:::layer{title="Intuition"}
A derivative tells you how sensitive an output is to a tiny change in its input. A large magnitude means that even a small input change can matter.
:::
:::layer{title="Geometry"}
At a differentiable point $(a,f(a))$, the tangent line is $y=f(a)+f'(a)(x-a)$. Its slope captures the local direction of the graph.
:::
:::layer{title="Precision"}
Differentiability means $f(a+h)=f(a)+f'(a)h+r(h)$ with $r(h)/h\to0$. The linear approximation becomes accurate relative to the size of the input change, not merely in an absolute sense.
:::
::::

## A derivative, one step at a time

Let us derive $f'(x)$ for $f(x)=x^2$. Before advancing each step, try to supply the algebra yourself. The essential move is to simplify while $h\ne0$, and only then take the limit.

::::derivation{title="Differentiating the square function"}
:::step{title="Begin with the definition" explanation="Replace f(x+h) by (x+h)² and f(x) by x²."}
$$
f'(x)=\lim_{h\to0}\frac{(x+h)^2-x^2}{h}.
$$
:::
:::step{title="Expand the square" explanation="The x² terms cancel because we are measuring a change."}
$$
f'(x)=\lim_{h\to0}\frac{2xh+h^2}{h}.
$$
:::
:::step{title="Cancel a common factor" explanation="For every h in the punctured neighborhood, h is nonzero."}
$$
f'(x)=\lim_{h\to0}(2x+h).
$$
:::
:::step{title="Take the limit" explanation="Now the expression is continuous in h, so evaluate it at zero."}
$$
\boxed{f'(x)=2x}.
$$
At $x=2$, this gives the velocity $4$ that our table suggested. The derivative function describes the rate at every input where the calculation applies.
:::
::::

:::warning{title="A limit is not substitution into 0/0"}
Substituting $h=0$ into the original quotient produces an undefined expression. It does not show that the derivative is zero, infinite, or nonexistent. Simplify or otherwise analyze the limit first.
:::

## Local linearity: a useful approximation

The tangent line gives a practical way to estimate nearby values. For $f(x)=x^2$ at $a=3$, we know $f(3)=9$ and $f'(3)=6$. Therefore

:::formula{title="Linear approximation" id="linear-approximation"}
$$
f(3+h)\approx 9+6h.
$$
:::

If $h=0.02$, the estimate for $3.02^2$ is $9.12$. The exact value is $9.1204$. The missing term is $h^2$, which is much smaller than $h$ when $h$ is small. This simple observation sits behind numerical methods, physical approximations, and sensitivity analysis.

:::question{title="Predict before calculating" prompt="Does the tangent-line estimate for the square function near x = 3 lie above or below the exact value?"}
The exact expansion is $(3+h)^2=9+6h+h^2$. Since $h^2\ge0$, the tangent-line estimate lies below the exact value for every nonzero $h$. The upward curvature explains the sign of the error.
:::

## When a derivative does not exist

Smoothness is an assumption worth checking. Consider $f(x)=|x|$ at the origin. Its graph has a corner, and no single tangent slope describes both sides.

::::tabs{title="Approaching the corner"}
:::tab{title="From the right"}
For $h>0$, $|h|=h$, so the difference quotient is $|h|/h=1$. The right-hand derivative is $1$.
:::
:::tab{title="From the left"}
For $h<0$, $|h|=-h$, so the difference quotient is $|h|/h=-1$. The left-hand derivative is $-1$.
:::
:::tab{title="The conclusion"}
The one-sided limits disagree. Therefore $|x|$ is continuous at zero but is not differentiable there. Continuity alone does not guarantee a derivative.
:::
::::

:::theorem{title="Differentiability implies continuity" id="continuity-theorem"}
If $f$ is differentiable at $a$, then $f$ is continuous at $a$.
:::

:::proof{title="Why a local slope forces continuity"}
For $h\ne0$, write

$$
f(a+h)-f(a)=h\frac{f(a+h)-f(a)}{h}.
$$

As $h\to0$, the first factor tends to zero and the second tends to the finite number $f'(a)$. Their product tends to zero. Thus $f(a+h)\to f(a)$, which is continuity at $a$.
:::

:::detail-level{level="detailed" title="A subtle distinction"}
A vertical tangent may look geometrically well defined, but an infinite difference-quotient limit is not a finite derivative under our definition. For example, $f(x)=\sqrt[3]{x}$ is continuous at zero and its graph has a vertical tangent there, while $f'(0)$ does not exist as a finite real number. Always distinguish the visual idea of a tangent from the precise definition being used.
:::

## Check your understanding

::::quiz{title="What does f′(2) = −3 tell us?" explanation="A derivative describes local sensitivity. Near the chosen input, output change is approximately the derivative multiplied by input change."}
:::choice{correct="false"}
The function value at $x=2$ is $-3$.
:::
:::choice{correct="true"}
Near $x=2$, a small input increase $h$ changes the output by approximately $-3h$.
:::
:::choice{correct="false"}
The function decreases by exactly $3$ whenever the input increases by $1$.
:::
::::

:::example{title="Try the definition yourself"}
Find the derivative of $g(x)=3x^2+2x-5$ directly from the difference quotient. Expand $g(x+h)$, subtract $g(x)$, divide by $h$, and then take the limit. Keep track of why the constant term disappears.
:::

:::hint{title="One useful intermediate line"}
After subtraction, the numerator is $6xh+3h^2+2h$. Every term contains $h$, so division leaves $6x+3h+2$.
:::

:::reveal{title="See the result"}
The derivative is $g'(x)=6x+2$. At $x=1$, the tangent has slope $8$ and passes through $(1,0)$, so its equation is $y=8(x-1)$.
:::

## Carry this idea forward

:::summary{title="The essential picture"}
- A difference quotient measures average change over an interval.
- A derivative is the limit of those rates as the interval shrinks.
- Geometrically, the derivative is the slope of the tangent; analytically, it is the coefficient of the best local linear approximation.
- Differentiability guarantees continuity, but a continuous function may still have a corner.
- Units and local approximation give the derivative meaning beyond a formula.
:::

Next, differentiation rules will let you calculate rates efficiently. Those rules are shortcuts built on the definition, so return to the moving point and the shrinking interval whenever a symbolic manipulation loses its meaning.
`;
