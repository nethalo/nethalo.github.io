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
subtitle: Short description for SEO
categories: [mysql, postgresql]
tags: [performance, monitoring, tools]
header_type: image  # or "hero", "post"
header_img: /assets/img/gallery/image-name.jpg
---
```

### Front Matter Defaults
Posts automatically inherit these settings from `_config.yml`:
- Comments enabled (via giscus)
- Social links shown
- Tags and categories displayed
- Related posts shown
- Breadcrumb navigation
- Author information
- Search indexing enabled

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
- Header images should be high quality and relevant to post content

### Markdown
Uses kramdown processor with:
- GFM (GitHub Flavored Markdown) input
- Syntax highlighting via rouge
- Dracula highlight theme
- Smart quotes enabled

## Site Theme and Styling

Custom Bootstrap 5 theme:
- Primary color: `#ffbe98` (defined in `_sass/_variables.scss`)
- Font family: Inter (Google Fonts)
- Background image on homepage
- Dracula syntax highlighting for code blocks
- Responsive design with Bootstrap grid and components
- Custom styles in `_sass/_custom.scss`

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
{% assign reading_time = words | divided_by: site.words_per_minute | default: 200 %}
```
**Solution**: Set default value BEFORE division operation:
```liquid
{% assign wpm = site.words_per_minute | default: 200 %}
{% assign reading_time = words | divided_by: wpm | at_least: 1 %}
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
