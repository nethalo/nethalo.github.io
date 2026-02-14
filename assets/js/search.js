(function() {
  'use strict';

  let searchIndex;
  let searchData;

  const searchInput = document.getElementById('search-input');
  const searchButton = document.getElementById('search-button');
  const searchResults = document.getElementById('search-results');

  if (!searchInput || !searchResults) {
    return;
  }

  // Fetch search data and build Lunr index
  async function initSearch() {
    try {
      const response = await fetch('/assets/js/search-data.json');
      searchData = await response.json();

      // Build Lunr index
      searchIndex = lunr(function() {
        this.ref('id');
        this.field('title', { boost: 10 });
        this.field('subtitle', { boost: 5 });
        this.field('categories', { boost: 5 });
        this.field('tags', { boost: 5 });
        this.field('content');

        searchData.forEach((doc) => {
          this.add(doc);
        });
      });

      console.log('Search index initialized with', searchData.length, 'posts');
    } catch (error) {
      console.error('Error loading search data:', error);
      displayError('Failed to load search data. Please try again later.');
    }
  }

  // Perform search
  function performSearch(query) {
    if (!query || query.trim() === '') {
      searchResults.innerHTML = '<p class="text-muted">Please enter a search query.</p>';
      return;
    }

    if (!searchIndex) {
      displayError('Search is not ready yet. Please wait a moment and try again.');
      return;
    }

    try {
      const results = searchIndex.search(query);
      displayResults(results, query);
    } catch (error) {
      console.error('Search error:', error);
      displayError('An error occurred during search. Please try a different query.');
    }
  }

  // Display search results
  function displayResults(results, query) {
    if (results.length === 0) {
      searchResults.innerHTML = `<p class="text-muted">No results found for "<strong>${escapeHtml(query)}</strong>".</p>`;
      return;
    }

    let html = `<p class="text-muted mb-4">Found ${results.length} result${results.length > 1 ? 's' : ''} for "<strong>${escapeHtml(query)}</strong>"</p>`;

    results.forEach((result) => {
      const post = searchData[result.ref];

      html += '<div class="search-result-item">';
      html += `<h3><a href="${post.url}">${escapeHtml(post.title)}</a></h3>`;

      if (post.subtitle) {
        html += `<p>${escapeHtml(post.subtitle)}</p>`;
      }

      html += '<div class="text-muted">';
      html += `<small><i class="far fa-calendar"></i> ${post.date}</small>`;

      if (post.categories && post.categories.length > 0) {
        html += ' <small>';
        post.categories.forEach((cat) => {
          html += `<span class="badge bg-primary ms-1">${escapeHtml(cat)}</span>`;
        });
        html += '</small>';
      }

      html += '</div>';
      html += '</div>';
    });

    searchResults.innerHTML = html;
  }

  // Display error message
  function displayError(message) {
    searchResults.innerHTML = `<div class="alert alert-danger">${message}</div>`;
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Event listeners
  searchButton.addEventListener('click', () => {
    performSearch(searchInput.value);
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch(searchInput.value);
    }
  });

  // Initialize search on page load
  initSearch();
})();
