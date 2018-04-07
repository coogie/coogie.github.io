---
# You don't need to edit this file, it's empty on purpose.
# Edit theme's home layout instead if you wanna make some changes
# See: https://jekyllrb.com/docs/themes/#overriding-theme-defaults
layout: default
title: Home
group: navigation
sort_order: 1
skills:
 - Agile/Kanban
 - Atomic Design
 - BEM Notation|Block-Element-Modifier
 - CSS Methodologies
 - Front-end Best Practices
 - Mobile-first Development
 - OOCSS|Object-oriented CSS
 - PWAs|Progressive Web Apps
 - Sass
 - ReactJS
 - Redux
---

<aside class="Site__content">
  {% capture specialise_content %}
    <p>
      Blurring the lines between where design stops and development starts. Establishing
      robust, scalable Design Systems and component libraries to introduce speed, 
      consistency, and reliability in products.
    </p>
  {% endcapture %}
  {% include site/block.html class="Specialise" title="Specialising in" content=specialise_content %}

  {% capture skill_content %}
    {% include site/tag-list.html items=page.skills %}
  {% endcapture %}
  {% include site/block.html class="Skills" title="Skills" content=skill_content %}
</aside>