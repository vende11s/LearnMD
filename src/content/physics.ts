export const physicsSource = String.raw`---
version: "1.0"
title: "Energy, motion, and the pendulum"
description: "Discover why the same mathematics appears in springs, circuits, and swinging masses."
subject: "Physics"
author: "LearnMD"
tags: [mechanics, oscillation, energy, modeling]
---

A pendulum passes through its lowest point with maximum speed, climbs until it momentarily stops, and swings back. Nothing about the motion is constant except, in an idealized model, the total energy.

This chapter uses that familiar motion to connect forces, energy, differential equations, and approximation. The goal is not only to obtain a period formula. It is to understand what makes the formula true, and when it stops being a good model.

## Build a model before writing an equation

Take a point mass $m$ suspended from a fixed pivot by a massless, inextensible string of length $L$. Assume uniform gravitational acceleration $g$, no air resistance, and no friction at the pivot. Let $\theta$ be the angular displacement from the downward vertical.

These assumptions remove complications while preserving the competition between inertia and a restoring force. They also provide a checklist for interpreting disagreement between the model and an experiment.

::::symbol-glossary{title="The quantities in our model"}
:::term{symbol="m" meaning="Bob mass"}
Measured in kilograms. In the ideal pendulum model, it cancels from the angular equation of motion.
:::
:::term{symbol="L" meaning="Distance from pivot to bob"}
Measured in meters. A longer pendulum has a longer period.
:::
:::term{symbol="g" meaning="Gravitational acceleration"}
Measured in meters per second squared. We treat it as uniform over the motion.
:::
:::term{symbol="θ" meaning="Angular displacement"}
Measured in radians from the downward vertical.
:::
:::term{symbol="θ̇" meaning="Angular velocity"}
Measured in radians per second. It is the time derivative of angular displacement.
:::
:::term{symbol="T" meaning="Oscillation period"}
Measured in seconds. One period is the time for one complete cycle.
:::
::::

Radians are essential when using calculus identities and the small-angle approximation. A numerical angle in degrees cannot be substituted into $\sin\theta\approx\theta$ without conversion.

## The restoring force

Gravity acts vertically downward. The string tension points toward the pivot and constrains the bob to a circular path. The component of gravity tangent to that path is $-mg\sin\theta$.

The negative sign carries the physics: when the bob is displaced to one side, the tangential force points back toward equilibrium. Since tangential acceleration is $L\ddot\theta$, Newton's second law gives

:::formula{title="The ideal pendulum equation" id="pendulum-equation"}
$$
\ddot\theta+\frac{g}{L}\sin\theta=0.
$$
:::

The mass cancels. In this ideal model, two bobs with different masses but the same string length and initial angle follow the same angular motion. Real effects such as air resistance can introduce mass-dependent behavior.

## Small angles reveal a familiar equation

Near equilibrium, $\sin\theta\approx\theta$ when the angle is measured in radians. Replacing the sine term produces a linear equation:

$$
\ddot\theta+\omega_0^2\theta=0,\qquad \omega_0=\sqrt{\frac{g}{L}}.
$$

This is the equation of simple harmonic motion. It also describes an ideal mass attached to a spring, with an appropriately defined natural angular frequency.

::::derivation{title="From the equation to the period"}
:::step{title="Try an oscillating solution"}
Let $\theta(t)=A\cos(\omega_0 t+\phi)$. Here $A$ is amplitude and $\phi$ sets the starting phase.
:::
:::step{title="Differentiate twice"}
$$
\ddot\theta(t)=-\omega_0^2A\cos(\omega_0t+\phi)=-\omega_0^2\theta(t).
$$
This is exactly the acceleration required by the linearized equation.
:::
:::step{title="Find one complete cycle"}
The cosine repeats when its argument increases by $2\pi$. Therefore $\omega_0T=2\pi$.
:::
:::step{title="Express the period in physical quantities"}
$$
\boxed{T=2\pi\sqrt{\frac{L}{g}}}.
$$
Longer pendulums swing more slowly; stronger gravity makes them swing faster.
:::
::::

:::warning{title="Amplitude independence is an approximation"}
The formula above is a small-angle result. For the exact ideal pendulum equation, the period increases with amplitude. Do not extend a conclusion beyond the approximation that produced it.
:::

## Energy gives a second view

Choose zero gravitational potential energy at the lowest point. At angle $\theta$, the bob rises by $L(1-\cos\theta)$, so

$$
U=mgL(1-\cos\theta),\qquad K=\frac12mL^2\dot\theta^2.
$$

In the ideal model, the total $E=K+U$ remains constant. Tension does no work because it is perpendicular to the bob's instantaneous motion. Gravity exchanges potential and kinetic energy rather than changing their sum.

::::tabs{title="Where is the energy?"}
:::tab{title="At a turning point"}
The bob is momentarily at rest, so $K=0$ and all of the mechanical energy is gravitational potential energy. The acceleration is generally not zero: a restoring force starts the bob moving back toward equilibrium.
:::
:::tab{title="At the lowest point"}
The potential energy is zero by our convention, and kinetic energy is maximal. The tangential acceleration is zero at that instant, but the bob still has radial acceleration because its direction of motion is changing.
:::
:::tab{title="Between the extremes"}
Both forms of energy are present. On the way down, potential energy decreases as kinetic energy increases; on the way up, the exchange reverses.
:::
::::

:::example{title="Find the maximum speed without solving the motion"}
Release the bob from rest at angle $\theta_0$. Conservation of energy between release and the lowest point gives

$$
mgL(1-\cos\theta_0)=\frac12mv_{\max}^2,
$$

so $v_{\max}=\sqrt{2gL(1-\cos\theta_0)}$. This result does not require a small-angle approximation. It does require the ideal assumptions, a taut string along the motion considered, and release from rest.
:::

## Check the dimensions before the arithmetic

Since $L/g$ has units of seconds squared, $\sqrt{L/g}$ has units of seconds, as a period should. Dimensional analysis cannot prove the factor $2\pi$, but it can catch an expression such as $2\pi L/g$, whose units are wrong.

For a length of $1.00$ meter and $g=9.81$ meters per second squared, the small-angle model gives a period of about $2.01$ seconds. Doubling the length multiplies the period by $\sqrt2$, not by $2$.

:::predict{title="What happens if you quadruple the length?" answer="The period doubles."}
Because $T\propto\sqrt L$, multiplying $L$ by four multiplies $T$ by $\sqrt4=2$. The result follows from scaling, without choosing a numerical value for $g$.
:::

## Real oscillators lose energy

Actual pendulums gradually stop. A useful extension adds a damping term proportional to angular velocity:

$$
\ddot\theta+2\beta\dot\theta+\omega_0^2\theta=0.
$$

For positive $\beta$, the damping force opposes motion and removes mechanical energy. Weak damping leads to oscillations with a decaying envelope. Strong enough damping can prevent oscillation altogether.

::::layers{title="Three levels of the model"}
:::layer{title="Ideal oscillation"}
Ignore losses and use small angles. The motion is sinusoidal, and the amplitude remains constant.
:::
:::layer{title="Weak damping"}
Include a modest velocity-dependent resistance. For $0<\beta<\omega_0$, the angular displacement has the form $Ae^{-\beta t}\cos(\omega_dt+\phi)$, where $\omega_d=\sqrt{\omega_0^2-\beta^2}$.
:::
:::layer{title="The limits of the model"}
Air resistance need not be exactly proportional to velocity. Large angles require the sine term. Flexible supports and extended bobs introduce additional dynamics. A refined model should address the dominant source of error in the question being asked, rather than adding complexity indiscriminately.
:::
::::

## Test your physical interpretation

::::quiz{title="At a turning point, which statement is correct?" explanation="Velocity is zero for an instant, but the restoring force generally remains nonzero. That force changes the velocity and starts the return swing."}
:::choice{correct="false"}
Both velocity and acceleration must be zero.
:::
:::choice{correct="true"}
Velocity is zero, while tangential acceleration generally points back toward equilibrium.
:::
:::choice{correct="false"}
The bob has lost all of its mechanical energy.
:::
::::

:::summary{title="A model is an argument with assumptions"}
The force equation explains how acceleration depends on displacement. The energy equation relates speed and position without requiring the full time-dependent solution. Linearization reveals simple harmonic motion and its period. Dimensional analysis checks consistency, and explicit assumptions tell us when to trust the result.
:::
`;
