(function () {
    const filtersRoot = document.getElementById('portfolio-filters');
    const grid = document.getElementById('portfolio-grid');
    if (!filtersRoot || !grid) return;

    const cards = Array.from(grid.querySelectorAll('.portfolio-card[data-tags]'));
    let frame = 0;

    function getActiveGroups() {
        const groups = {};
        filtersRoot.querySelectorAll('input[type="checkbox"]').forEach((input) => {
            if (!input.checked) return;
            const tax = input.closest('.portfolio-filter__group')?.dataset.tax || 'misc';
            if (!groups[tax]) groups[tax] = [];
            groups[tax].push(input.value.toLowerCase());
        });
        return groups;
    }

    function cardMatches(card, groups) {
        const tags = (card.getAttribute('data-tags') || '').toLowerCase();
        const activeKeys = Object.keys(groups);
        if (!activeKeys.length) return true;

        return activeKeys.every((tax) =>
            groups[tax].some((value) => tags.split(',').includes(value))
        );
    }

    function applyFilters() {
        const groups = getActiveGroups();
        cards.forEach((card) => {
            card.hidden = !cardMatches(card, groups);
        });
    }

    function scheduleApply() {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(applyFilters);
    }

    filtersRoot.addEventListener('change', scheduleApply);

    const clearBtn = filtersRoot.querySelector('.portfolio-filter__clear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            filtersRoot.querySelectorAll('input[type="checkbox"]').forEach((input) => {
                input.checked = false;
            });
            scheduleApply();
        });
    }
})();
