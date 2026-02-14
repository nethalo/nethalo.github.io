# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Jekyll-based static blog called **Rendiment**, focused on database performance (MySQL and PostgreSQL). It uses the [Chulapa theme](https://github.com/dieghernan/chulapa) and is hosted on GitHub Pages.

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
- **`_includes/custom/`**: Custom HTML includes that extend the theme
  - `giscus.html`: GitHub Discussions-based comments integration
  - `custom_head.html`, `custom_bottomscripts.html`: Custom scripts/styles
- **`assets/img/gallery/`**: Images used in blog posts and pages
- **`assets/css/`**: Custom CSS overrides (`custom.scss`)
- **`_config.yml`**: Main site configuration (theme settings, navigation, plugins, SEO)
- **`blog/index.html`**: Paginated blog listing page

### Theme Architecture
The site uses the Chulapa remote theme via `remote_theme: dieghernan/chulapa` in `_config.yml`. Theme files are not in this repo - they're pulled from the remote theme during build.

Custom overrides:
- Custom includes in `_includes/custom/` are automatically loaded by the theme
- CSS customizations via `assets/css/custom.scss`
- Theme skin configuration in `_config.yml` under `chulapa-skin`

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
- **Plugins**: jekyll-github-metadata, jekyll-paginate, jekyll-include-cache, jekyll-sitemap

### `Gemfile`
Dependencies managed via Bundler:
- `github-pages` gem provides Jekyll and compatible plugins
- `jekyll-algolia` for Algolia search (configured but not currently active)
- `jekyll-sitemap` for SEO

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

Current skin: `lymcha` with autothemer enabled
- Primary color: `#ffbe98`
- Font family: Inter (Google Fonts)
- Background image on homepage
- Custom CSS in `assets/css/custom.scss`

## Important Notes

- **No local theme files**: The Chulapa theme is loaded remotely. Don't expect to find theme layouts/includes in this repo.
- **GitHub Pages compatibility**: All plugins must be in the GitHub Pages allowlist.
- **Build time**: The site uses Lunr search which indexes content at build time. Large sites may have slower builds.
- **Comments**: giscus requires the GitHub repo discussions feature to be enabled.
