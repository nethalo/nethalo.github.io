/**
 * Category Filter - Client-side filtering for blog cards
 * Filters both featured and regular cards by category
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const filterButtons = document.querySelectorAll('.cat-btn');
    const featuredCard = document.querySelector('.featured-card');
    const regularCards = document.querySelectorAll('.post-card-new');

    if (filterButtons.length === 0) return;

    filterButtons.forEach(button => {
      button.addEventListener('click', function() {
        const category = this.getAttribute('data-category');

        // Update active button
        filterButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');

        // Filter cards
        filterCards(category, featuredCard, regularCards);
      });
    });
  }

  function filterCards(category, featuredCard, regularCards) {
    // Show all if "all" is selected
    if (category === 'all') {
      if (featuredCard) {
        featuredCard.parentElement.style.display = '';
      }
      regularCards.forEach(card => {
        card.style.display = '';
      });
      return;
    }

    // When filtering by category, hide featured card to avoid duplication
    if (featuredCard) {
      featuredCard.parentElement.style.display = 'none';
    }

    // Filter regular cards
    regularCards.forEach(card => {
      const cardCategories = (card.getAttribute('data-categories') || '').toLowerCase();
      const shouldShow = cardCategories.includes(category.toLowerCase());
      card.style.display = shouldShow ? '' : 'none';
    });
  }
})();
