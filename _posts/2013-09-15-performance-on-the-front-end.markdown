---
layout: post
title: "Performance on the Front-end"
date: 2013-09-15 23:58
comments: true
categories: [Web Development, Front-end, CSS, JavaScript]
description: "Front-end performance can be incredibly tricky at times. Here's some advice to help you get started in the right direction!"
facebook:
    image: http://www.gravatar.com/avatar/e7e5cb5a71155eb1409a8d84d52726c1.jpg?s=250
    type: article
---

The web, by its very nature and design, is synchronous. Things are parsed and executed as soon as they are reached, and there are some *very* important things to note about how CSS and JavaScript work in front-end web development:

 - CSS blocks rendering
 - Assets download in parallel, except Javascript
 - JavaScript blocks downloads

Now, while this might instill a sense of "wat" in you, it's all done for good (and smart) reasons, and it's also be something that all front-end devs should be aware of.

<!-- more -->

<h2 class="gamma">Styles</h2>

CSS blocks page rendering because browsers want to render things as they get to them and in the correct order. Browsers won't render pages until they know all the styles available, meaning they don't have to go back and apply new styles to already-rendered elements, causing an expensive (and jarring) redraw.

<h2 class="gamma">Assets</h2>

The <a href="http://www.w3.org/Protocols/rfc2616/rfc2616-sec8.html#sec8.1.4" title="Hypertext Transfer Protocol -- HTTP/1.1 - Sec. 8.1.4">HTTP/1.1 spec</a> makes the suggestions that browsers should use a maximum of two connections at a time to each domain:

> Clients that use persistent connections SHOULD limit the number of simultaneous connections that they maintain to a given server. A single-user client SHOULD NOT maintain more than 2 connections with any server or proxy. A proxy SHOULD use up to 2*N connections to another server or proxy, where N is the number of simultaneously active users. These guidelines are intended to improve HTTP response times and avoid congestion.

On the assumption that browsers download a max of two assets from one domain, we can crank up the amount of assets we can download at once by using a Content Delivery Network. If we're downloading a stylesheet and an image at the same time from `http://www.coog.ie/`, we can download a stylesheet and *three* images at the same time by using `http://static1.coog.ie/` and `http://static2.coog.ie/`, with each serving two files, alternating between the two domains.

But things get a little troublesome when it comes to JavaScript.

<h2 class="gamma">Scripts</h2>

So, know we know that downloads happen in parallel, and having more domains to pull from means downloading more assets faster. However, JavaScript prevents this. Yep... It blocks it entirely.

It does this for two reasons:

 - The script being called could alter the DOM which means the browser will have to handle the changes before it can proceed with anything else.
 - Typically, scripts need to be loaded, and executed, in a specific order.

Browsers block parallel downloads with JavaScript because your 10KB jQuery plugin will most definitely download and execute before the 80KB GZipped jQuery library does.

This is awesome, in terms of making your JavaScript work well, but it means bad news for evrything else on our page because while a script is downloading, it will prevent the browser downloading any other assets, regardless of which domain it's on. So, based on this, JavaScript should be moved to the end of the HTML, typically just before the `</body>` tag.

Unfortunately, not all scripts can be moved to the end of the document. If a script uses `document.write` to insert part of the page's content, then we can't move it lower in the page. In situations like this, we need to split our JavaScript files into those that we can move lower in the page, and those we can keep in the `<head>`, but in order to make this situation less painful for us, we should make sure that any JavaScript we load in the `<head>` is loaded *after* any CSS we have.

<h2 class="gamma">tl;dr -- Putting the knowledge to use</h2>

So, using the things we've learned, we now know that to improve performance on the front-end we should do the following:

 - Place CSS at the top, in the `<head>`
 - Use a CDN to increase the number of parallel downloads
 - Place JavaScript at the bottom, before `</body>`
 - If placing the JavaScript at the bottom is not an option, then another performance gain can be had from placing it in the head, after the CSS.