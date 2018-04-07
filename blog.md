---
layout: default
title: Posts
group: navigation
sort_order: 2
body_modifier: posts
---

<section class="RecentPosts">
  <h1 class="RecentPosts__title SectionTitle">Recent posts</h1>
  {%- for post in site.posts -%}
    {%- if site.posts.size > 0 -%}
      <article class="Preview">
        <header class="Preview__header">
          <h1 class="Preview__title">
            <a class="Preview__link" href="{{ post.url | relative_url }}">
              {{- post.title | escape -}}
            </a>
          </h1>
          <div class="Preview__meta">
            <div class="Preview__date">
              {%- include site/icon.html icon="calendar" -%}
              {%- include blog/date.html date=post.date -%}
            </div>
          </div>
        </header>
        {%- if site.show_excerpts -%}
          <main class="Preview__content">
            {{ post.excerpt }}
          </main>
          <footer class="Preview__footer">
            <a class="Button" href="{{ post.url | relative_url }}">Read full</a>
          </footer>
        {%- endif -%}
      </article>
    {% else %}
      <p>Nothing to display!</p>
    {% endif %}
  {% endfor %}
</section>

{%- include site/sidebar.html -%}