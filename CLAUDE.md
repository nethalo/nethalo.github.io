# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Jekyll-based static blog called **Rendiment**, focused on database performance (MySQL and PostgreSQL). It uses a custom Bootstrap 5 theme (migrated from Chulapa in Feb 2026) and is hosted on GitHub Pages.

## Development Commands

### Local Development
```bash
# Install dependencies
bundle install

# Serve the site locally with live reload
bundle exec jekyll serve --livereload

# Build the site (output to _site/)
bundle exec jekyll build
```

The site will be available at `http://localhost:4000`.

### Deployment
Site automatically deploys to GitHub Pages when pushed to the `main` branch. No manual deployment needed.

## Architecture

### Site Structure
- **`_posts/`**: Blog posts in markdown format with naming convention `YYYY-MM-DD-title.md`
- **`_pages/`**: Static pages (404, archive, categories, tags, search)
- **`_layouts/`**: Custom Jekyll layouts (compress, base, minimal, default, archive, tags, categories, search)
- **`_includes/`**: Reusable HTML components (navbar, footer, post components, pagination)
  - `giscus.html`: GitHub Discussions-based comments integration
  - `navbar.html`, `footer.html`: Site navigation components
  - Post components: `header-image.html`, `breadcrumb.html`, `post-meta.html`, `tags.html`, `categories.html`, `author.html`, `related-posts.html`, `bottom-navs.html`
  - `post-card.html`, `pagination.html`: Blog listing components
- **`_sass/`**: SCSS partials (`_variables.scss`, `_syntax.scss`, `_custom.scss`)
- **`assets/css/`**: Main stylesheet (`main.scss`)
- **`assets/js/`**: JavaScript files (`search.js`, `search-data.json` for Lunr.js)
- **`assets/img/gallery/`**: Images used in blog posts and pages
- **`_config.yml`**: Main site configuration (theme settings, navigation, plugins, SEO)
- **`blog/index.html`**: Paginated blog listing page

### Theme Architecture
The site uses a **custom self-contained Bootstrap 5 theme** (no remote dependencies):
- **Bootstrap 5.3.0** loaded via CDN for responsive layout and components
- **Font Awesome 6** loaded via CDN for icons
- **Custom SCSS** with Dracula syntax highlighting theme
- **Lunr.js** for client-side search functionality
- **Google Fonts** (Inter and Roboto) for typography
- All layouts and includes are in this repository (no external theme)

## Creating Blog Posts

Blog posts must follow this format:

### File Naming
`_posts/YYYY-MM-DD-title-slug.md`

### Front Matter Template
```yaml
---
title: "Post Title"
subtitle: Short description for on-page display
description: SEO-optimized meta description (150-160 characters, keyword-rich, compelling)
categories: [mysql, postgresql]
tags: [performance, monitoring, tools]
header_type: hero  # Hero image for prominent display
header_img: /assets/img/gallery/image-name.jpg
---
```

### Required Fields for SEO

**IMPORTANT:** All new posts MUST include these fields:

1. **`description`** (required) - SEO meta description
   - Length: 150-160 characters (Google's display limit)
   - Include primary keywords naturally
   - Make it compelling - this appears in search results
   - Different from `subtitle` (subtitle is for on-page display)
   - Example: `"Learn how to identify MySQL InnoDB contention points using the SEMAPHORES section in SHOW ENGINE INNODB STATUS for high-concurrency environments."`

2. **`subtitle`** (optional) - Shown on the page under the title
   - Can be creative/catchy
   - Example: `"Useful info from the semaphores section"`

3. **`header_img`** (recommended) - Header image
   - Place images in `/assets/img/gallery/`
   - **MUST be optimized before committing** (see Image Optimization section below)
   - Max width: 1600px
   - JPEGs at 85% quality
   - File size target: <400KB

### Front Matter Defaults
Posts automatically inherit these settings from `_config.yml`:
- Comments enabled (via giscus)
- Social links shown
- Tags and categories displayed
- Related posts shown
- Breadcrumb navigation
- Author information
- Search indexing enabled
- **JSON-LD Article schema** (automatic for all posts with dates)

### SEO Best Practices for New Posts

When creating a new post, follow these guidelines:

**1. Meta Description**
- Always include a `description` field (separate from `subtitle`)
- Write for humans first, optimize for keywords second
- Include primary keyword within first 120 characters
- End with a call-to-action or value proposition

**2. Internal Linking**
- Link to at least 2-3 related posts within the content
- Use contextual anchor text (not "click here")
- Place links where they add value for readers
- Topic clusters: MySQL monitoring posts should link to each other

**3. Image Optimization**
- All images MUST be optimized before committing
- Use `sips` (macOS) to resize and compress:
  ```bash
  # Resize JPEG to 1600px width, 85% quality
  # IMPORTANT: --setProperty formatOptions silently fails on JPEGs; use -s flags instead
  sips -s format jpeg -s formatOptions 85 --resampleWidth 1600 image.jpg

  # Resize PNG to 1600px width
  sips --resampleWidth 1600 image.png
  ```
- Target file sizes:
  - Header images: <400KB
  - Content screenshots: <300KB
  - Diagrams/charts: <200KB

**4. Categories and Tags**
- Use existing categories when possible (mysql, postgresql, monitoring, tools)
- Tags should be specific and relevant
- Limit to 3-6 tags per post
- Categories create taxonomy, tags are for discovery

**5. Content Structure**
- Use H2 (`##`) for main sections
- Use H3 (`###`) for subsections
- Include code examples where relevant
- Add a conclusion or summary section
- Consider adding a "Further Reading" section with internal links

## Configuration Files

### `_config.yml`
Main configuration file containing:
- **SEO settings**: title, description, author, social links
- **Navigation**: navbar and footer configuration
- **Theme customization**: colors, fonts, skins
- **Search**: Currently using Lunr.js (local search)
- **Comments**: Using giscus (GitHub Discussions)
- **Analytics**: Google Analytics (gtag_id: G-6MGB047ESJ)
- **Pagination**: 4 posts per page in `/blog/`
- **Plugins**: jekyll-github-metadata, jekyll-paginate, jekyll-sitemap, jekyll-feed

### `Gemfile`
Dependencies managed via Bundler:
- `github-pages` gem provides Jekyll and compatible plugins
- `jekyll-github-metadata` for GitHub repository metadata
- `jekyll-sitemap` for SEO sitemap generation

## Content Guidelines

### Images
- Place images in `assets/img/gallery/`
- Reference in posts as `/assets/img/gallery/image-name.jpg`
- **MUST be optimized before committing** (max 1600px width, <400KB for headers)
- Header images should be high quality and relevant to post content
- Use `sips` to optimize:
  ```bash
  # For JPEGs (photos, complex images)
  # IMPORTANT: --setProperty formatOptions silently fails on JPEGs; use -s flags instead
  sips -s format jpeg -s formatOptions 85 --resampleWidth 1600 image.jpg

  # For PNGs (screenshots, diagrams)
  sips --resampleWidth 1600 image.png
  ```

### Markdown
Uses kramdown processor with:
- GFM (GitHub Flavored Markdown) input
- Syntax highlighting via rouge
- Dracula highlight theme
- Smart quotes enabled

## SEO Infrastructure (Feb 2026)

The site has comprehensive SEO infrastructure in place. **All new posts automatically benefit from:**

### Automatic Features
- ✅ **JSON-LD Article schema** - BlogPosting structured data included in `<head>` via `_includes/schema-article.html`
  - Includes: headline, dates, author, publisher, description, image, categories, tags
  - Only renders on posts with `layout: default` and `page.date`
  - Eligible for Google rich results (author bylines, article badges)

- ✅ **Open Graph tags** - Social media preview cards (Facebook, LinkedIn, Twitter)
  - Uses `page.header_img` or `site.og_image` as fallback
  - Title, description, and image automatically populated

- ✅ **Canonical URLs** - Prevents duplicate content issues

- ✅ **Sitemap generation** - `jekyll-sitemap` plugin creates `/sitemap.xml`

- ✅ **robots.txt** - Properly configured with User-agent and Allow directives

### Manual Requirements
When creating a new post, YOU MUST:

1. **Add `description` field** - 150-160 characters, keyword-rich
2. **Optimize images** - Before committing, use `sips` to resize/compress
3. **Add internal links** - Link to 2-3 related posts within content
4. **Use proper categories** - Stick to existing: mysql, postgresql, monitoring, tools, proxysql

### Topic Clusters (for internal linking)

Link new posts to these established clusters:

**MySQL Monitoring Cluster:**
- [Contention in MySQL InnoDB](/mysql/innodb/2024/09/01/innodb-semaphore-contention.html)
- [Monitoring MySQL with Coroot](/mysql/monitoring/2024/09/05/coroot-mysql-first-test.html)
- [Smart Alerting: Dynamic Thresholds](/monitoring/prometheus/2024/09/10/smart-alerting-dynamic-thresholds.html)
- [PMM Query Analytics with Redash](/mysql/postgresql/pmm/percona/monitoring/2024/09/19/pmm-query-analytics-clickhouse.html)

**PXC/Galera Management Cluster:**
- [Test ProxySQL Read/Write Split](/mysql/proxysql/2026/02/03/sysbench-proxysql.html)
- [Introducing dbsafe](/mysql/tools/2026/02/14/introducing-dbsafe-know-before-you-alter.html)

**PostgreSQL:**
- [Fuzzy and Semantic Search in PostgreSQL](/postgresql/2026/01/21/pgtrgm-pgvector-music.html)

### Pre-Commit Checklist

Before committing a new post:
- [ ] `description` field is 150-160 characters
- [ ] Images are optimized (<400KB for headers, <300KB for content)
- [ ] Added 2-3 internal links to related posts
- [ ] Categories and tags are appropriate
- [ ] Code examples are tested and accurate
- [ ] Spell-checked and proofread

### End-to-End Guide: Post with Terminal Screenshots

Use this when writing a post that includes VHS terminal screenshots (e.g. dbsafe output, CLI tools).

**Step 1 — Create the post file**

```
_posts/YYYY-MM-DD-title-slug.md
```

Front matter with placeholder image paths:
```yaml
---
title: "Post Title"
subtitle: Short on-page description
description: "150-160 char SEO description with primary keywords."
categories: [mysql, tools]
tags: [mysql, ddl, dbsafe]
header_type: hero
header_img: /assets/img/gallery/post-hero.jpg
---
```

**Step 2 — Write the content**

- Use H2 for main sections, H3 for subsections
- Add internal links to 2-3 related posts (see Topic Clusters above)
- Use `![alt text](/assets/img/gallery/screenshot-name.png)` as placeholder where screenshots will go
- Write the alt text to be descriptive — it matters for SEO and accessibility

**Step 3 — Create tape files for each screenshot**

One `.tape` file per screenshot. Name them to match the output PNG:

```tape
Output assets/img/gallery/screenshot-name.gif

Set Shell "bash"
Set FontSize 14
Set Width 1200
Set Height 900
Set Theme "Dracula"
Set TypingSpeed 40ms
Set Padding 20

Type `export DBSAFE_PASSWORD=dbsafe_demo`
Enter
Sleep 500ms

Type `/Users/dani/dbsafe/dbsafe plan -H 127.0.0.1 -P 23306 -u dbsafe -d demo "ALTER TABLE ..."`
Enter
Sleep 5s

Screenshot assets/img/gallery/screenshot-name.png
Sleep 1s
```

Height guide: use `900` for normal output, `1100` when output is tall (e.g. includes pt-osc command).

**Important**: `Output *.gif` is a required throwaway — without it, `Screenshot` silently produces nothing (VHS bug #540). Use a relative path; absolute paths cause a parser error in VHS 0.10.0.

**Step 4 — Run the tapes** *(must be done in your terminal, not Claude Code)*

```bash
vhs screenshot-name.tape
# repeat for each tape
```

**Step 5 — Verify the screenshots**

```bash
# Must say "PNG image data", not "directory"
file assets/img/gallery/screenshot-name.png

# Check sizes: target <300KB for content screenshots
ls -lh assets/img/gallery/screenshot-name.png
```

If a PNG is over 300KB, convert to JPEG:
```bash
sips -s format jpeg -s formatOptions 85 assets/img/gallery/screenshot-name.png \
  --out assets/img/gallery/screenshot-name.jpg
# then update the img reference in the post from .png to .jpg
```

**Step 6 — Clean up**

```bash
# Delete throwaway GIFs
rm assets/img/gallery/*.gif
```

Tape files are gitignored (`*.tape`) — leave them on disk for future re-runs.

**Step 7 — Optimize the hero image**

```bash
# JPEG hero (photos)
sips -s format jpeg -s formatOptions 85 --resampleWidth 1600 hero.jpg

# PNG hero (diagrams, screenshots) — note: sips can't quality-compress PNGs
sips --resampleWidth 1600 hero.png
# if still >400KB after resize, convert to JPEG instead
```

**Step 8 — Commit**

```bash
git add _posts/YYYY-MM-DD-title-slug.md assets/img/gallery/screenshot-name.png assets/img/gallery/post-hero.jpg
git commit -m "Add post: short description"
git push
```

Do **not** add: `.gif` files, `.tape` files, `_site/`, `.DS_Store`.

## Site Theme and Styling

Custom Bootstrap 5 theme with modern design system (Feb 2026 coral red rebrand):
- **Primary color**: `#E7494C` coral red (defined in `_sass/_variables.scss`)
- **Dark sections**: `#1A2332` navy blue for contrast sections
- **Typography**: DM Sans (headings/body) + JetBrains Mono (code) via Google Fonts
- **Design features**: Glassmorphism navbar, scroll animations, horizontal blog cards
- **Code highlighting**: Darker Dracula theme (`#0e1421` background) for better contrast
- **Responsive design**: Mobile-first with Bootstrap 5 grid and custom breakpoints

### Design System Architecture

**Modular SCSS Structure** (`assets/css/main.scss` imports in specific order):
1. `_variables.scss` - All design tokens (colors, spacing, typography, effects)
2. `_base.scss` - Global styles, resets, Bootstrap overrides
3. Component partials: `_navbar`, `_hero`, `_cards`, `_footer`, etc.
4. `_animations.scss` - Keyframes and scroll-triggered animations
5. `_post.scss` - Individual post content styling
6. `_custom.scss` - Site-specific overrides (loaded last)

**Color Variable Strategy**:
- Use **semantic names** not literal colors: `--accent-green` for primary color (even though it's now coral red)
- Makes complete rebrands trivial: only update values in `_variables.scss`, not hundreds of CSS references
- Example: Feb 2026 green→coral rebrand changed ~8 variable values instead of 50+ hardcoded colors
- Also search for hardcoded rgba() values when rebranding: `rgba(0, 155, 110, ...)` → `rgba(231, 73, 76, ...)`

**Component Architecture**:
- Each major section has dedicated include + SCSS partial: hero, blog-listing, dark-section, tech-stack, etc.
- JavaScript in `assets/js/`: category filtering, scroll animations, typing effects
- All components use CSS custom properties from `_variables.scss` for consistency

## Important Notes

- **Self-contained theme**: All layouts and includes are in this repository. No remote theme dependencies.
- **GitHub Pages compatibility**: All plugins must be in the GitHub Pages allowlist.
- **Build time**: The site uses Lunr search which indexes content at build time. Large sites may have slower builds.
- **Comments**: giscus requires the GitHub repo discussions feature to be enabled.
- **SCSS processing**: SCSS files in `assets/css/` should NOT have YAML front matter (causes compilation errors on GitHub Pages).

## Lessons Learned (Theme Migration - Feb 2026)

### Liquid Template Issues
**Problem**: Division by zero error in reading time calculation when `site.words_per_minute` is not configured.
```liquid
{% raw %}{% assign reading_time = words | divided_by: site.words_per_minute | default: 200 %}{% endraw %}
```
**Solution**: Set default value BEFORE division operation:
```liquid
{% raw %}{% assign wpm = site.words_per_minute | default: 200 %}
{% assign reading_time = words | divided_by: wpm | at_least: 1 %}{% endraw %}
```
**Lesson**: The `| default:` filter applies to the variable it's attached to, not to the result of operations. Always set defaults before using variables in calculations.

### SCSS Compilation on GitHub Pages
**Problem**: SCSS files with YAML front matter (`---` at the top) caused compilation errors:
```
Invalid CSS after "...": expected "{", was "" on line 3
```
**Solution**: Remove YAML front matter from SCSS files in `assets/css/` directory. Start directly with `@import` statements.

**Lesson**: GitHub Pages (github-pages gem) processes SCSS files differently than standard Jekyll. SCSS files in `assets/css/` should be plain SCSS without front matter. The SCSS processor detects `.scss` extension automatically.

### Jekyll Liquid Filters
**Best Practices**:
- Use `| default: value` immediately after variable assignment
- Chain filters in order: `variable | default: 200 | at_least: 1`
- For division/math operations, ensure variables have defaults set first
- Use `| at_least: 1` to prevent zero results in calculations

### Bootstrap 5 vs Bootstrap 4
**Changes from Chulapa (Bootstrap 4)**:
- Class changes: `ml-*` → `ms-*`, `mr-*` → `me-*`
- Dropdown toggle requires `data-bs-toggle` instead of `data-toggle`
- JavaScript initialization uses `bootstrap.bundle.min.js` (includes Popper)
- Forms use `form-control` with updated styling

### Git Workflow
**Commit Strategy**: For major migrations, break into logical commits:
1. Main migration commit (layouts, includes, config changes)
2. Bug fix commits (division by zero, SCSS issues)
3. Each fix addresses one specific build error

This makes it easier to identify and revert specific changes if needed.

## Lessons Learned (Coral Red Redesign - Feb 2026)

### SEO Best Practices for Tag/Category Pages

**Problem**: Aggregation pages like `/tags` and `/categories` create thin/duplicate content that can hurt SEO, but users need landing pages when clicking tag links on posts.

**Solution**: Use `robots: noindex, follow` meta tag in page front matter:
```yaml
---
layout: tags
title: Tags
permalink: /tags
robots: noindex, follow
---
```

Add robots meta tag support in `_layouts/base.html`:
```html
{% if page.robots %}
<meta name="robots" content="{{ page.robots }}">
{% endif %}
```

**Benefits**:
- `noindex` prevents search engines from indexing thin content
- `follow` allows crawlers to follow links to actual posts
- Users get functional landing page, SEO stays clean
- Remove aggregation pages from navbar to reduce visibility, but keep them accessible via post tag links

### Client-Side Category Filtering

**Pattern**: Blog category filtering without page reloads using data attributes + vanilla JavaScript.

**Implementation**:
1. Add `data-categories` attribute to post cards with comma-separated categories
2. Filter buttons have `data-category` attribute (e.g., "mysql", "postgresql", "all")
3. JavaScript toggles card visibility based on category match
4. Hide featured card when filtering (prevent duplication since featured post appears in grid)

**Benefits**:
- No page reloads = instant filtering
- All posts loaded once = better performance than multiple pages
- Simple vanilla JS = no framework overhead
- Featured post handling prevents duplicate content

**Code location**: `assets/js/category-filter.js` + `_includes/blog-listing.html`

### Color Rebrand Strategy

**Lesson**: Complete visual rebrand (green #009b6e → coral red #E7494C) completed in under 30 minutes using semantic CSS variables.

**Steps**:
1. Update CSS custom properties in `_sass/_variables.scss` (primary source of truth)
2. Search for hardcoded hex values: `#009b6e` in all SCSS/HTML files
3. Search for hardcoded rgba values: `rgba(0, 155, 110, ...)` in SCSS files
4. Update SVG fill/stroke colors in includes (hero, tech-stack, section-divider)
5. Test across all pages: homepage, blog listing, individual posts, dark sections

**Why it worked**:
- Semantic variable names (`--accent-green`, `--accent-green-dark`) instead of `--color-green`
- Single source of truth in `_variables.scss`
- Only ~15 hardcoded color references to update (vs hundreds if no variables)
- Design tokens approach: update values, not selectors

### Scroll Animation Performance

**Pattern**: IntersectionObserver for scroll-triggered animations (better than scroll event listeners).

**Implementation**:
- `assets/js/scroll-animate.js` observes elements with `.animate-on-scroll` class
- Adds `.is-visible` class when element enters viewport (8% threshold)
- CSS handles actual animations via transitions/keyframes
- `@media (prefers-reduced-motion)` disables animations for accessibility

**Benefits**:
- No scroll event listeners = better performance
- Respects user accessibility preferences
- Staggered child animations with CSS nth-child delays
- Fires once per element (not on every scroll frame)

### HTML Compression and Empty Elements

**Problem**: Hero header images displayed on `localhost:4000` but were invisible on production (GitHub Pages). Jekyll's `compress.html` layout (configured with `clippings: all`) strips elements that appear empty during HTML compression.

**Root Cause**: The `<div class="header-image">` element had no inner content—it relied entirely on CSS `background-image` and `height` properties. The compressor treated it as empty whitespace and removed it.

**Solution**: Add visually-hidden content inside the div to prevent removal:
```html
<div class="header-image" style="background-image: url('...');">
  <span class="visually-hidden">Header image for {{ page.title }}</span>
</div>
```

**Why it works**:
- The div now has non-whitespace content, so the compressor preserves it
- `visually-hidden` (Bootstrap 5) hides the text visually but keeps it accessible to screen readers
- Bonus: improves accessibility by providing context to screen reader users

**File**: `_includes/header-image.html`

**Lesson**: When using aggressive HTML compression (`clippings: all`), decorative elements that rely purely on CSS styling need non-whitespace content to survive compression. Always test on GitHub Pages before assuming localhost behavior matches production.

### sips JPEG Quality Flag Bug

**Problem**: The documented `sips --setProperty formatOptions 85 image.jpg` command silently fails on JPEG files. sips shows a warning (`Output file suffix should be png`) and ignores the quality setting, leaving the file at its original encoding — or bloating it on repeated round-trips.

**Solution**: Use explicit `-s` flags instead:
```bash
# CORRECT — quality is applied
sips -s format jpeg -s formatOptions 85 --resampleWidth 1600 image.jpg

# BROKEN — quality setting silently ignored on JPEGs
sips --resampleWidth 1600 --setProperty formatOptions 85 image.jpg
```

**Additional note**: sips round-trips PNG files with poor compression. If a PNG screenshot is too large and `pngquant`/`optipng` are unavailable, convert it to JPEG:
```bash
sips -s format jpeg -s formatOptions 70 image.png --out image.jpg
```
Then update the post's image reference from `.png` to `.jpg`.

### VHS Terminal Screenshots

VHS is used to generate styled terminal screenshots (Dracula theme) for blog posts. The binary is at `/Users/dani/dbsafe/vhs` or available as `vhs` in PATH.

**Correct tape structure** — `Screenshot` requires `Output` to initialize the recording pipeline (VHS bug #540). Without `Output`, `Screenshot` silently produces no file:

```tape
Output assets/img/gallery/my-screenshot.gif

Set Shell "bash"
Set FontSize 14
Set Width 1200
Set Height 900
Set Theme "Dracula"
Set TypingSpeed 40ms
Set Padding 20

Type `your command here`
Enter
Sleep 5s

Screenshot assets/img/gallery/my-screenshot.png
Sleep 1s
```

**Key rules:**
- `Output` must use a **relative path** — absolute paths (starting with `/`) cause a parser error in VHS 0.10.0
- Use `Output assets/img/gallery/name.gif` as a throwaway to initialize the pipeline; delete the GIF after
- `Screenshot` captures a single PNG at that exact moment
- Always add `Sleep 1s` after `Screenshot` (workaround for VHS bug #540)
- Height: 1100 for tall output (pt-osc commands), 900 for shorter output

**VHS cannot run inside the Claude Code sandbox** (no PTY devices). The user must run tapes directly in their terminal.

**After running tapes:**
1. Verify: `file assets/img/gallery/my-screenshot.png` — must be a single PNG file, not a directory
2. Check sizes: `ls -lh assets/img/gallery/my-screenshot.png` — target <300KB for content screenshots
3. Delete throwaway GIFs: `rm assets/img/gallery/*.gif`
4. PNG terminal screenshots at 1200px are usually 150–350KB — acceptable to keep as PNG for text sharpness
