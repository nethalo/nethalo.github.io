# Rendiment

A Jekyll-based static blog focused on database performance (MySQL and PostgreSQL), built with a custom Bootstrap 5 theme.

**Live Site**: [https://nethalo.github.io](https://nethalo.github.io)

## Features

- **Custom Bootstrap 5 Theme**: Self-contained theme with no remote dependencies
- **Blog Posts**: Markdown-based posts with pagination (4 posts per page)
- **Search**: Client-side search powered by Lunr.js
- **Archive Pages**: Posts grouped by year, category, and tag
- **Comments**: GitHub Discussions integration via giscus
- **Syntax Highlighting**: Dracula theme for code blocks
- **Responsive Design**: Mobile-first design with Bootstrap 5
- **SEO Optimized**: Open Graph tags, Twitter cards, sitemap generation
- **RSS Feed**: Automatic feed generation via jekyll-feed

## Architecture

### Tech Stack
- **Jekyll**: Static site generator
- **Bootstrap 5.3.0**: CSS framework (loaded via CDN)
- **Font Awesome 6**: Icon library (loaded via CDN)
- **Lunr.js**: Client-side search engine
- **Google Fonts**: Inter and Roboto typefaces
- **GitHub Pages**: Hosting and deployment

### Site Structure
- `_posts/`: Blog posts in Markdown format
- `_layouts/`: Custom Jekyll layouts (compress, base, minimal, default, archive, tags, categories, search)
- `_includes/`: Reusable components (navbar, footer, post components, pagination)
- `_sass/`: SCSS partials (variables, syntax highlighting, custom styles)
- `assets/`: CSS, JavaScript, and images
- `_pages/`: Static pages (404, archive, categories, tags, search)

## Development

### Prerequisites
- Ruby 3.0+ (required for latest gems)
- Bundler

### Local Development
```bash
# Install dependencies
bundle install

# Serve site locally with live reload
bundle exec jekyll serve --livereload

# Build site
bundle exec jekyll build
```

The site will be available at `http://localhost:4000`.

### Deployment
The site automatically deploys to GitHub Pages when changes are pushed to the `main` branch.

## Creating Blog Posts

Create a new Markdown file in `_posts/` with the naming convention:
```
YYYY-MM-DD-title-slug.md
```

### Front Matter Template
```yaml
---
title: "Post Title"
subtitle: Short description for SEO
categories: [mysql, postgresql]
tags: [performance, monitoring, tools]
header_type: image
header_img: /assets/img/gallery/image-name.jpg
---
```

Posts automatically inherit settings from `_config.yml` defaults (comments, tags, categories, author info, etc.).

## Configuration

Main configuration is in `_config.yml`:
- Site metadata and SEO settings
- Navigation (navbar and footer)
- Google Analytics
- Search settings
- Pagination
- Author information
- Plugin configuration

## Theme Customization

### Colors
Edit `_sass/_variables.scss` to customize:
- Primary color (default: `#ffbe98`)
- Font families
- Spacing variables

### Styles
Custom styles are in `_sass/_custom.scss`:
- Component styles
- Layout adjustments
- Responsive breakpoints

### Syntax Highlighting
Dracula theme configured in `_sass/_syntax.scss`. Can be regenerated with:
```bash
bundle exec rougify style dracula > _sass/_syntax.scss
```

## License

© Rendiment 2026