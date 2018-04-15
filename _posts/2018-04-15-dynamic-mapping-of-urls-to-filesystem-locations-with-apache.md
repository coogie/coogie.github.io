---
title: Dynamic Mapping of URLs to Filesystem Locations with Apache
comments: true
---

We've recently jumped into the world of Jenkins Multibranch Pipelines for one of the
products we build in CarTrawler, and we couldn't be much happier with the speed and
flexibility it provides - allowing us to test, build, and deploy branches asynchronously
and at scale without having to rely on a particular "build" branch, enabling us to test
and demo features on our staging environment in isolation from other features.

One aspect of this was that we needed to deploy multiple versions of the product to our
staging environment and be capable of accessing each one based off the URL. We took the
approach of using a JIRA ticket number to access the feature/story that was being tested
and, in order to do this, we needed to get our Apache vhost to serve from a different
directory dynamically.

Ultimately, the flow of it all goes like so:

  1. Deploy app to `/home/jenkins/projectname/[JIRA-ID]`.
  2. Access app from `http://projectname.internal.test/[JIRA-ID]/projectname`.
  3. Serve app from `/home/jenkins/projectname/[JIRA-ID]`, based on what the URL was.

If you're wondering why the URL is structured so, this particular project runs in a
directory on top of another product, and is expecting to be on the `/projectname` endpoint.
The subdomain is our way of directing requests to the relevant products on our staging
environment (such as `product1.internal.test`, `product2.internal.test`, etc.).

## Writing our Apache config

So, let's get on with writing our Apache vhost config. If you're comfortable with Apache
configs, then feel free to [skip to the end](#end) for the full config.

### Establish the core

```conf
<Virtualhost *:80>
  ServerName projectname.internal.test
  DocumentRoot /home/jenkins/projectname
</Virtualhost>
```
First off, we need to write the core of our Virtual Host by establishing the `ServerName`
and `DocumentRoot` directives. This sets us up so that a request to
`http://projectname.internal.test/index.html` trigger our Virtualhost and resolves to
`/home/jenkins/projectname/index.html`

### Alias requests to the appropriate directory
Next, we make use of [Apache's `AliasMatch`](https://httpd.apache.org/docs/2.4/mod/mod_alias.html#aliasmatch)
which is where the bulk of our work happens. `AliasMatch` allows us to use a regex on the
URL that came in, capture our desired parts, and resolve to a directory of our choosing
if the URL matched that regex.

```conf
  AliasMatch "^/([-\w]+)/projectname(?:/(.*))?$" "/home/jenkins/projectname/$1/$2"
```

Above, we match on `/PR-123/projectname/foo/bar` and, since we make use of [regex
capturing groups](https://www.regular-expressions.info/brackets.html), we can use the
captured values as variables `$1` and `$2` allowing us to resolve to
`/home/jenkins/projectname/PR-123/foo/bar`.

## Making it work with Single-page Apps

Normally, that would be enough to get up and running, but this particular project is a
single-page application with its own internal router, which means we need to route *all*
URLs pointing to `/projectname/ANYTHING` back to the project's index without changing the
URL itself, but only when that URL isn't a valid file or directory on the filesystem.

Let's get to it!

```conf
<LocationMatch "^/.*/projectname/.*">
  RewriteEngine On
  RewriteBase /
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_FILENAME} !-l
  RewriteCond %{REQUEST_FILENAME} projectname\/([-\w]+)(?:\/(.*))?
  RewriteRule ^(.*)$ /%1/projectname/index.html [L]
</LocationMatch>
```

First, we need to establish a [`LocationMatch` directive](https://httpd.apache.org/docs/2.4/mod/core.html#locationmatch).
This directive takes a regex which, when matched, allows the directives contained inside
it to run. Once inside, we enable the `RewriteEngine` and set the `RewriteBase` to `/`.
This establishes the base path that our future rewrites will work off.

Next, we head into our `RewriteCond` directives. These directives allow us to define
conditions for whether our `RewriteRule` actually triggers. So, in order, these are:

  1. The requested filename is **not** a regular file
  2. The requested filename is **not** a directory
  3. The requested filename is **not** a symlink
  4. The requested filename matches the desired regex pattern

Finally, our `RewriteRule` will trigger only if its own rule is matched (`^(.*)$`) **and**
all preceding `RewriteCond` directives are true. Note the use of `%1` in our rule - this
is a backreference exposed by the last `RewriteCond` regex used, allowing us to use the 
values of the regex capture groups from that rule.

### The flow

So after all of that, the final flow of a request made to 
`http://projectname.internal.test/PR-123/projectname/subview` in our Apache vhost goes
like so:

  1. Matches our `AliasMatch` and becomes a request to load
     `/home/jenkins/projectname/PR-123/projectname/subview` from here on out
  2. Matches our `<LocationMatch>` and begins our Rewrite block
  3. The request is not a file that exists at this location
  4. The request is not a directory that exists at this location
  5. The request is not a symlink that exists at this location
  6. The request matches our regex **and** all previous conditions, so becomes a new
     request to `http://projectname.internal.test/PR-123/projectname/index.html`
  7. The request comes back in from the top and matches our `AliasMatch`, resolving to
     `/home/jenkins/projectname/PR-123/projectname/index.html`
  8. Matches our `<LocationMatch>` and begins our Rewrite block
  9. This time, the requested location **is** a file on the filesystem, so we return it to
     the browser

<div id="end"></div>

## The final config

After all that, our final config looks like the following:

```conf
<Virtualhost *:80>
    ServerName projectname.internal.test
    DocumentRoot /home/jenkins/projectname

    AliasMatch "^/([-\w]+)/projectname(?:/(.*))?$" "/home/jenkins/projectname/$1/$2"

    <LocationMatch "^/.*/projectname/.*">
        RewriteEngine On
        RewriteBase /
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteCond %{REQUEST_FILENAME} !-l
        RewriteCond %{REQUEST_FILENAME} projectname\/([-\w]+)(?:\/(.*))?
        RewriteRule ^(.*)$ /%1/projectname/index.html [L]
    </LocationMatch>
</Virtualhost>
```