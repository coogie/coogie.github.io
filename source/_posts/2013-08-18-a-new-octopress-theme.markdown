---
layout: post
title: "A new Octopress theme"
date: 2013-08-18 23:59
comments: true
categories: [Octopress, Web Development]
description: "Oscailte is a light and clean theme, built using inuit.css, for use on Octopress sites."
facebook:
  image: http://www.gravatar.com/avatar/e7e5cb5a71155eb1409a8d84d52726c1.jpg?s=250
  type: article
---

Allow me to introduce to you a new Octopress theme, called Oscailte!

Oscailte is an important milestone for me for many reasons. First of all, it's my first step into creating a theme usable by anybody, not just by me on my own sites! Yay! Secondly, it's the first open-source project that I've put out into the great wild web, free for all to download and scrutinise through [Github](https://github.com/coogie/oscailte/)!

But enough about all of this, let's move on to getting the theme up and running. These installation instructions are available in the [theme's README file](https://github.com/coogie/oscailte/blob/master/README.md) which will have the most up-to-date instructions.

<!-- more -->

{% img http://i.imgur.com/0GlIXHW.jpg Oscailte Preview %}

## Installation

Oscailte requires that your system be running Sass 3.2.9 (Media Mark) or greater, so you may need to run a `bundle update` before you run your initial `rake generate` after installing the theme. You can check your current gem version by running `gem list sass`.

Because Oscailte also uses git submodules to pull in [inuitcss](http://inuitcss.com), when you run `git clone` you must add in the `--recursive` option in order to get it working.

You can install Oscailte like so:

    $ cd your_octopress_directory
    $ git clone --recursive https://github.com/coogie/oscailte.git .themes/oscailte
    $ rake install['oscailte']
    $ rake generate

## Features

### Homepage

Oscailte includes a clean page, separated from the blogging capabilities of Octopress. The theme can be modified to instead use just the blog index as the homepage.

### Gravatar

Oscailte makes use of the `site.email` used in `_config.yml` (if present) to grab and display your Gravatar if you use one. Otherwise, the theme will instead display the default Gravatar logo, which can be changed by replacing the file locally.

If you wish to make use of the Gravatar feature, please ensure you use an email address that you do not mind being publicly crawlable by bots/spiders.

### Social Sidebar

Oscailte allows you to display links to your other online profiles in a quick and easy fashion. To display the sidebar links to your other profiles, you must add the following to your `_config.yml` file.

{% codeblock %}
social:
  title: # Defaults to "Follow me!" if not present
  adn: # App.net
  dribbble:
  facebook:
  github:
  googleplus:
  linkedin:
  pinterest:
  stackoverflow:
  twitter:
  youtube:
{% endcodeblock %}

Oscailte only supports the above sites, but more may be added as the user sees fit.

## Collaboration

[Oscailte is available on Github](https://github.com/coogie/oscailte) under the [MIT Licence](https://github.com/coogie/oscailte/blob/master/LICENCE.md)! I would greatly appreciate any help in both optimising the theme and improving the customisation available to users, so if you want to help out then feel free to [submit issues or pull requests](https://github.com/coogie/oscailte/issues)!

So that's Oscailte, my first Octopress theme! I learned a lot about both Octopress and theme development from this project. And if *you* would like to learn anything or just have questions about Oscailte, the feel free to get in touch with me or leave a comment below!