export const networksSource = String.raw`---
version: "1.0"
title: "A packet’s journey across the internet"
description: "Follow a request through names, connections, layers, and trust boundaries."
subject: "Computer networks"
author: "LearnMD"
tags: [networking, protocols, tcp, dns, security]
---

You enter a web address, press Return, and a page appears. That familiar action hides a remarkable collaboration: name resolution, routing, transport, encryption, and application protocols, implemented by machines that do not share a single owner.

We will follow a simplified HTTPS request using TCP. Real browsers may reuse cached answers and existing connections, and HTTP/3 uses QUIC instead of TCP. A carefully chosen model is useful as long as we keep its boundaries visible.

## Names, addresses, and ports answer different questions

A hostname identifies a service in a human-friendly namespace. An IP address helps the network deliver packets to an interface. A port helps an operating system deliver transport traffic to the appropriate endpoint on that machine.

:::definition{title="An endpoint is more than a hostname"}
For a TCP connection, the source IP address, source port, destination IP address, and destination port identify the two communicating endpoints. A familiar HTTPS service commonly listens on port $443$, while the client uses a temporary local port.
:::

Domain Name System queries translate names into records, including address records. A response may already exist in a browser, operating-system, or resolver cache. Caching reduces delay and load, but it also means a changed record does not instantly replace every previously cached answer.

:::warning{title="DNS is not the same as authentication"}
Obtaining an address for a hostname does not by itself prove that the server at that address is the intended service. HTTPS adds server authentication through TLS certificate validation. Different layers answer different trust questions.
:::

## Each layer has a job

Layering lets applications rely on a service without implementing every detail below it. The boundaries are conceptual tools, not claims that real implementations are perfectly isolated.

::::architecture{title="A simplified network stack"}
:::node{id="application" label="Application · HTTP" description="Expresses a request and response: method, path, headers, and content."}
:::
:::node{id="security" label="Security · TLS" description="Authenticates the server and protects application data in transit."}
:::
:::node{id="transport" label="Transport · TCP" description="Provides an ordered byte stream with retransmission and flow control."}
:::
:::node{id="network" label="Network · IP" description="Addresses and forwards packets across interconnected networks."}
:::
:::node{id="link" label="Link · Wi-Fi or Ethernet" description="Moves frames across one local link toward the next hop."}
:::
:::edge{from="application" to="security" label="Request bytes"}
:::
:::edge{from="security" to="transport" label="Protected records"}
:::
:::edge{from="transport" to="network" label="Segments"}
:::
:::edge{from="network" to="link" label="Packets"}
:::
::::

Think of **encapsulation** as placing a message inside envelopes. Each layer adds information needed for its own job. At the destination, the receiving stack interprets those headers and passes the payload upward.

A router usually forwards based on network-layer information; it does not need to understand the web page. A Wi-Fi frame normally reaches the next hop on a local link, not the final web server across the world.

## The first request, in order

Assume an uncached name lookup and a new TCP connection. The browser resolves the hostname, establishes transport, negotiates TLS, sends an HTTP request, and receives a response.

::::sequence{title="From a name to a response"}
:::participant{id="browser" label="Browser"}
:::
:::participant{id="resolver" label="DNS resolver"}
:::
:::participant{id="server" label="Web server"}
:::
:::message{from="browser" to="resolver" label="Resolve the hostname"}
:::
:::message{from="resolver" to="browser" label="Return an address record"}
:::
:::message{from="browser" to="server" label="Establish a TCP connection"}
:::
:::message{from="browser" to="server" label="Negotiate TLS and verify the server"}
:::
:::message{from="browser" to="server" label="Send the encrypted HTTP request"}
:::
:::message{from="server" to="browser" label="Return the encrypted HTTP response"}
:::
::::

The drawing compresses exchanges into conceptual messages. A TCP handshake contains multiple segments; a TLS negotiation also contains more than one message. The purpose here is to distinguish responsibilities and order, not to reproduce a packet capture.

## What TCP promises, and what it does not

IP packets may be lost, duplicated, or arrive out of order. TCP builds a reliable, ordered byte stream over that imperfect service by tracking sequence numbers, acknowledging received data, and retransmitting when necessary.

:::intuition{title="Reliable does not mean instant"}
Imagine receiving numbered pages of a letter. If page three is missing, you can detect the gap and ask for it again. You can reconstruct the letter in order, but you may have to wait before handing later pages to the reader.
:::

TCP provides a stream of bytes, not application-message boundaries. If an application sends two messages, the receiving program may read them together, separately, or in smaller pieces. The application protocol must define how to identify complete messages.

::::tabs{title="Two kinds of control"}
:::tab{title="Flow control"}
The receiver advertises how much data it can accept. This protects a slow receiver from being overwhelmed by a fast sender. The question is: how much room does the receiving endpoint have?
:::
:::tab{title="Congestion control"}
The sender adjusts its behavior based on indications of network capacity and congestion. This helps avoid overwhelming the path between endpoints. The question is: how much traffic can the network currently sustain?
:::
::::

These controls interact, but they solve different problems. A powerful receiving computer cannot eliminate congestion at an overloaded link along the route.

## Latency is a budget

A request can feel slow even when the connection has high bandwidth. **Latency** is the time required for an event or exchange. **Bandwidth** is a rate at which data can be transferred. A wide road does not shorten the distance between two cities.

For a simplified transfer of $S$ bits at bottleneck rate $R$ bits per second, transmission alone takes $S/R$ seconds. Propagation delay, queueing, protocol exchanges, server work, and browser rendering add other costs.

:::formula{title="A useful, deliberately incomplete model"}
$$
T_{\mathrm{total}}\approx T_{\mathrm{setup}}+T_{\mathrm{server}}+T_{\mathrm{propagation}}+\frac{S}{R}+T_{\mathrm{queueing}}.
$$
:::

The terms may overlap in real systems, so this is a reasoning aid rather than a universal measurement equation. For small responses, setup exchanges may dominate. For large downloads, transfer time often matters more.

## Locate the fault before changing the system

Troubleshooting improves when a symptom is connected to a layer and a testable hypothesis. “The internet is broken” is too broad to guide a useful experiment.

::::scenario{title="Three failures that look similar"}
:::case{title="The hostname does not resolve"}
The browser cannot obtain a usable address. Investigate the name, resolver, cache, and local network configuration. Repeatedly changing application code does not address a failed name lookup.
:::
:::case{title="The connection times out"}
An address may be available, but no successful transport connection is established. Possible causes include routing, filtering, an unavailable endpoint, or an incorrect address. A timeout identifies a symptom, not a unique cause.
:::
:::case{title="The server returns an error response"}
An HTTP response such as a server error indicates that an application-level exchange occurred. This narrows the investigation toward the service, its dependencies, and request handling, although network problems may still affect those dependencies.
:::
::::

:::section{title="Encrypted does not mean invisible"}
TLS protects application content between its endpoints, but observers may still learn metadata such as IP addresses, timing, and traffic volume. A system's privacy properties depend on more than encryption alone. The endpoint receiving plaintext remains part of the trust boundary.
:::

## Check the model

::::quiz{title="A large download is fast, but tiny requests feel slow. What is a plausible explanation?" explanation="High throughput and high latency can coexist. Connection setup and round trips can dominate short exchanges even when sustained transfer is fast."}
:::choice{correct="true"}
The path has good sustained throughput but high round-trip latency.
:::
:::choice{correct="false"}
Bandwidth and latency are always the same quantity.
:::
:::choice{correct="false"}
TCP guarantees that every request completes instantly.
:::
::::

:::summary{title="Keep the responsibilities separate"}
DNS helps locate an address. IP forwards packets. Link protocols carry frames to a next hop. TCP provides an ordered byte stream. TLS protects and authenticates a connection. HTTP gives the exchange application meaning. Understanding their cooperation makes both performance and failures easier to reason about.
:::
`;
