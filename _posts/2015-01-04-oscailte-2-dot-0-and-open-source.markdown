---
layout: post
title: "Oscailte 2.0 and Open Source"
date: 2015-01-04 10:35:17 +0000
comments: true
categories: [Web Development, Open Source, Octopress]
description: "Front-end performance can be incredibly tricky at times. Here's some advice to help you get started in the right direction!"
facebook:
    image: https://www.gravatar.com/avatar/e7e5cb5a71155eb1409a8d84d52726c1.jpg?s=250
    type: article
---

It's been just over a year since [I first released Oscailte][1] into the wild.
And since then, I've not only learned a few things about working with Octopress
and creating themes for it, but I've also learned a lot about managing my code,
its structure, and in general how to make my life easier when creating projects.

<!-- more -->

When I first created Oscailte, I had planned to create a personal theme for myself
and never really intended (or expected) for it to be used by anybody else. Yet here
we are 103 stars and 24 forks later, and Oscailte is being used by people such as
[Tony Guntharp][3] (co-founder of SourceForge.net), the [Nokogiri parsing gem][4],
and even The University of Virginia's [Intro to Programming course portal][5]. So
it's been a little humbling, to say the least, that these people (among others) are
happily using Oscailte for their Octopress installations! :D

And with that, I'd like to [re-release Oscailte as v2.0][2], which contains a great
deal of changes to the theme and how it's structured, while keeping the original
aestehtics of it intact. There are some slight changes here and there that do change
the overall style of it, but only very slightly, and I'd like to just quickly go over
some of the changes here.

## Goodbye Inuit.css
While I absolutely love Harry Roberts and everything he's done for the industry, I
have decided to remove inutcss from Oscailte. I feel as though I liked the concepts
used throughout it than the actual project itself. The project isn't bad, at all, it's
just that I didn't use enough of it throughout Oscailte to warrant having it as a
dependency.

## Architecture
The original architecture of Oscailte was a mess. It was hastily cobbled together and
didn't really make much sense looking back at it. It was also a bit of a nightmare to
maintain! That's all changed now that I have started applying the [concept of SMACSS into
it][6]. Structure makes a lot more sense now, and things are so much easier to find and modify.

## Block-Element-Modifier (BEM)
BEM is something that has interested me for quite some time now, and it's a methodology
that I have even started applying to my own code in work. It's an amazing naming
convention that, put simply, makes your code easier to understand. There are
other benefits to this as well, such as reduced specificity issues, which makes
BEM a win-win for me. If you'd like to learn more, check out ["MindBEMding – getting your head ’round BEM syntax"][7]
over on CSS Wizardy.

## Variables and customisation
Customisation is a huge thing for me. I'm working really hard to make Oscailte
incredibly simple to customise with as little work as possible. As such, I've
extracted as many of the styles as possible out into SCSS variables - so much
more than before! Sure, [older versions of Oscailte had SCSS variables][8], but
there wasn't a great deal of them, they could be somewhat confusing, and I'm pretty
sure they were broken in one or two places. Now there are a [huge amount of SCSS
variables available in Oscailte 2.0][9], and they are all broken out into their
respective components and sections.

## Octopress 3 and Open Source
So, with Octopress 3 just around the corner, I do have plans to migrate
Oscailte over to support it. I have no idea how much work is involved in doing
so, I haven't even had the time to sit down and check out Octopress 3 for myself,
but it will happen. If there's one thing that this project has done for me, it's
help bolster my love for Open Source and make me want to keep giving back!


[1]:  http://coog.ie/blog/2013/08/18/a-new-octopress-theme/
[2]:  https://github.com/coogie/oscailte/releases
[3]:  http://fusion94.org/
[4]:  http://www.nokogiri.org/
[5]:  http://cs1110.cs.virginia.edu/
[6]:  https://github.com/coogie/oscailte/blob/master/sass/oscailte/_oscailte.scss
[7]:  http://csswizardry.com/2013/01/mindbemding-getting-your-head-round-bem-syntax/
[8]:  https://github.com/coogie/oscailte/blob/fb04062e3099d9d901bf848d6eafefb300d73b8e/sass/oscailte/_variables.scss
[9]:  https://github.com/coogie/oscailte/blob/master/sass/oscailte/_variables.scss
