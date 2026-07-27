document.querySelectorAll(".ld-process").forEach((processSection) => {
    const tabs = Array.from(processSection.querySelectorAll(".ld-process__tab"));
    const panels = Array.from(processSection.querySelectorAll(".ld-process__panel"));
    let activeIndex = 0;

    function updateArrowStates() {
        processSection.querySelectorAll(".ld-process__panel").forEach((panel, panelIndex) => {
            if (panelIndex !== activeIndex) return;

            const prev = panel.querySelector('[data-direction="previous"]');
            const next = panel.querySelector('[data-direction="next"]');

            if (prev) prev.disabled = activeIndex === 0;
            if (next) next.disabled = activeIndex === tabs.length - 1;
        });
    }

    function showStep(index, moveFocus = false) {
        if (index < 0 || index >= tabs.length) return;

        activeIndex = index;

        tabs.forEach((tab, tabIndex) => {
            const isActive = tabIndex === activeIndex;
            tab.classList.toggle("is-active", isActive);
            tab.setAttribute("aria-selected", String(isActive));
            tab.setAttribute("tabindex", isActive ? "0" : "-1");
        });

        panels.forEach((panel, panelIndex) => {
            const isActive = panelIndex === activeIndex;
            panel.classList.toggle("is-active", isActive);
            panel.hidden = !isActive;
        });

        updateArrowStates();

        const activeTab = tabs[activeIndex];
        activeTab.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center",
        });

        if (moveFocus) {
            activeTab.focus();
        }
    }

    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => {
            showStep(index);
        });

        tab.addEventListener("keydown", (event) => {
            if (event.key === "ArrowRight") {
                event.preventDefault();
                showStep(Math.min(index + 1, tabs.length - 1), true);
            }

            if (event.key === "ArrowLeft") {
                event.preventDefault();
                showStep(Math.max(index - 1, 0), true);
            }

            if (event.key === "Home") {
                event.preventDefault();
                showStep(0, true);
            }

            if (event.key === "End") {
                event.preventDefault();
                showStep(tabs.length - 1, true);
            }
        });
    });

    processSection.querySelectorAll(".ld-process__arrow").forEach((button) => {
        button.addEventListener("click", () => {
            const direction = button.dataset.direction;

            if (direction === "next") {
                showStep(activeIndex + 1);
            }

            if (direction === "previous") {
                showStep(activeIndex - 1);
            }
        });
    });

    updateArrowStates();
});
