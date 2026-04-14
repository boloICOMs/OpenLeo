/**
 * Handles navigation, interactive viewers, and scroll behavior.
 */

document.addEventListener('DOMContentLoaded', () => {
    /* --- Sticky Header Logic --- */
    let lastScrollTop = 0;
    const nav = document.querySelector('nav');
    const scrollThreshold = window.innerHeight / 2;

    if (nav) {
        window.addEventListener('scroll', () => {
            let scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            if (scrollTop > scrollThreshold) {
                if (scrollTop > lastScrollTop) {
                    nav.classList.add('nav-hidden');
                } else {
                    nav.classList.remove('nav-hidden');
                }
            } else {
                nav.classList.remove('nav-hidden');
            }

            lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
        }, false);
    }

    /* --- Mobile Menu Logic --- */
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const navLinks = document.getElementById('nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });

        // Close menu when a link is clicked
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!menuToggle.contains(e.target) && !navLinks.contains(e.target)) {
                navLinks.classList.remove('active');
            }
        });
    }

    /* --- Media Carousel (Persuasion Page) --- */
    const carousel = document.getElementById('media-carousel');
    const prevArrow = document.getElementById('carousel-prev');
    const nextArrow = document.getElementById('carousel-next');

    if (carousel && prevArrow && nextArrow) {
        const scrollAmount = 330; // Card width + gap

        prevArrow.addEventListener('click', () => {
            carousel.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        });

        nextArrow.addEventListener('click', () => {
            carousel.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        });

        carousel.addEventListener('scroll', () => {
            prevArrow.style.opacity = carousel.scrollLeft <= 0 ? '0.3' : '1';
            prevArrow.style.pointerEvents = carousel.scrollLeft <= 0 ? 'none' : 'auto';

            const maxScroll = carousel.scrollWidth - carousel.clientWidth;
            nextArrow.style.opacity = carousel.scrollLeft >= maxScroll - 1 ? '0.3' : '1';
            nextArrow.style.pointerEvents = carousel.scrollLeft >= maxScroll - 1 ? 'none' : 'auto';
        });

        // Trigger initial state
        carousel.dispatchEvent(new Event('scroll'));
    }

    /* --- Custom Novel Page Functions (Manuscript Viewer - Persuasion Page) --- */
    const manuscriptImg = document.getElementById('manuscript-img');
    const transcriptionText = document.getElementById('transcription-text');
    const pageNumDisplay = document.getElementById('page-num');
    const manuscriptPrevBtn = document.getElementById('prev-btn');
    const manuscriptNextBtn = document.getElementById('next-btn');

    if (manuscriptImg && transcriptionText) {
        let persuasionXml = null;
        let persuasionXsl = null;

        const manuscriptPages = [
            {
                pageNum: 1,
                img: "img/persuasion/p.1.jpg",
                facs: "#facs_1"
            }
        ];

        let currentManuscriptPage = 0;
        let activeOverlay = null;

        async function initTranscription() {
            try {
                const [xmlResponse, xslResponse] = await Promise.all([
                    fetch('p.xml'),
                    fetch('p.xsl')
                ]);
                const xmlText = await xmlResponse.text();
                const xslText = await xslResponse.text();

                const parser = new DOMParser();
                persuasionXml = parser.parseFromString(xmlText, 'text/xml');
                persuasionXsl = parser.parseFromString(xslText, 'text/xml');

                updateManuscriptPage();

                // Add event listener for line clicks (using delegation)
                transcriptionText.addEventListener('click', (e) => {
                    const line = e.target.closest('.transcription-line, .transcription-p');
                    if (line && line.dataset.facs) {
                        highlightLine(line.dataset.facs, line);
                    }
                });
            } catch (error) {
                console.error('Error loading transcription files:', error);
                transcriptionText.innerHTML = '<p class="error-msg">Error loading digital transcription. Please ensure persuasion.xml and persuasion.xsl are available.</p>';
            }
        }

        
        

        function highlightLine(facsId, lineElement) {
            // Remove previous highlights
            document.querySelectorAll('.transcription-line.active').forEach(l => l.classList.remove('active'));
            if (activeOverlay) {
                activeOverlay.remove();
                activeOverlay = null;
            }

            // Add highlight to text
            lineElement.classList.add('active');

            // Find coordinates in XML
            const zoneId = facsId.replace('#', '');
            // More robust selector for xml:id
            const zone = persuasionXml.querySelector(`[*|id="${zoneId}"]`) ||
                persuasionXml.querySelector(`zone[xml\\:id="${zoneId}"]`) ||
                persuasionXml.getElementById(zoneId);

            if (zone && zone.getAttribute('points')) {
                const pointsStr = zone.getAttribute('points');
                drawHighlight(pointsStr);
            } else {
                console.warn(`No zone found for ${zoneId}`);
            }
        }

        function drawHighlight(pointsStr) {
            // Remove previous overlay if it exists
            if (activeOverlay) activeOverlay.remove();

            // Create SVG overlay
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("class", "manuscript-overlay");

            // Position SVG exactly over the rendered image
            // We use offsetLeft/Top/Width/Height which represent the displayed dimensions
            svg.style.position = 'absolute';
            svg.style.left = `${manuscriptImg.offsetLeft}px`;
            svg.style.top = `${manuscriptImg.offsetTop}px`;
            svg.style.width = `${manuscriptImg.clientWidth}px`;
            svg.style.height = `${manuscriptImg.clientHeight}px`;

            // The viewBox should match the NATURAL dimensions of the original XML coordinates
            svg.setAttribute("viewBox", `0 0 ${manuscriptImg.naturalWidth} ${manuscriptImg.naturalHeight}`);

            const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            polygon.setAttribute("points", pointsStr.replace(/,/g, ' '));
            polygon.setAttribute("class", "highlight-zone");

            svg.appendChild(polygon);
            manuscriptImg.parentElement.appendChild(svg);
            activeOverlay = svg;
        }

        function renderTranscription(facsId) {
            if (!persuasionXml || !persuasionXsl) return '<p class="loading-msg">Loading digital transcription...</p>';

            try {
                const processor = new XSLTProcessor();
                processor.importStylesheet(persuasionXsl);
                processor.setParameter(null, 'pageFacs', facsId);

                const resultDoc = processor.transformToFragment(persuasionXml, document);
                if (!resultDoc) throw new Error("Transformation failed");

                const tempDiv = document.createElement('div');
                tempDiv.appendChild(resultDoc);
                return tempDiv.innerHTML;
            } catch (e) {
                console.error("XSLT Transformation Error:", e);
                return '<p class="error-msg">Transformation error. Check console for details.</p>';
            }
        }

        function updateManuscriptPage() {
            manuscriptImg.style.opacity = 0;
            transcriptionText.style.opacity = 0;

            // Clear previous highlight
            if (activeOverlay) {
                activeOverlay.remove();
                activeOverlay = null;
            }

            setTimeout(() => {
                const data = manuscriptPages[currentManuscriptPage];
                manuscriptImg.src = data.img;

                transcriptionText.innerHTML = renderTranscription(data.facs);
                transcriptionText.scrollTop = 0;

                if (pageNumDisplay) pageNumDisplay.innerText = data.pageNum;

                manuscriptImg.style.opacity = 1;
                transcriptionText.style.opacity = 1;

                if (manuscriptPrevBtn) manuscriptPrevBtn.disabled = currentManuscriptPage === 0;
                if (manuscriptNextBtn) manuscriptNextBtn.disabled = currentManuscriptPage === manuscriptPages.length - 1;

                // Match heights once image is loaded
                if (manuscriptImg.complete) {
                    adjustTranscriptionHeight();
                } else {
                    manuscriptImg.onload = adjustTranscriptionHeight;
                }
            }, 300);
        }

        function adjustTranscriptionHeight() {
            const box = document.querySelector('.transcription-box');
            // Match the height of the image as displayed on screen
            if (box && manuscriptImg.complete && manuscriptImg.clientHeight > 0) {
                const rect = manuscriptImg.getBoundingClientRect();
                box.style.height = `${rect.height}px`;
            } else if (box) {
                // Fallback if image not ready
                box.style.height = 'auto';
                box.style.maxHeight = '80vh';
            }
        }

        if (manuscriptPrevBtn) {
            manuscriptPrevBtn.addEventListener('click', () => {
                if (currentManuscriptPage > 0) {
                    currentManuscriptPage--;
                    updateManuscriptPage();
                }
            });
        }

        if (manuscriptNextBtn) {
            manuscriptNextBtn.addEventListener('click', () => {
                if (currentManuscriptPage < manuscriptPages.length - 1) {
                    currentManuscriptPage++;
                    updateManuscriptPage();
                }
            });
        }

        initTranscription();
        window.addEventListener('resize', adjustTranscriptionHeight);
    }

    /* --- Annotation Comparison Viewer (Annotation Page) --- */
    const evalImg = document.getElementById('eval-img');
    const ai1Text = document.getElementById('ai-1-text');
    const ai2Text = document.getElementById('ai-2-text');
    const evalPageNum = document.getElementById('eval-page-num');
    const evalPrevBtn = document.getElementById('eval-prev');
    const evalNextBtn = document.getElementById('eval-next');

    if (evalImg && ai1Text && ai2Text) {
        const evalPages = [
            {
                img: "img/eval/p.1.jpg",
                ai1: `<p>all>`
            }
        ];

        let currentEvalPage = 0;

        function updateEvalPage() {
            const data = evalPages[currentEvalPage];

            [evalImg, ai1Text, ai2Text].forEach(el => el.style.opacity = 0);

            setTimeout(() => {
                evalImg.src = data.img;
                ai1Text.innerHTML = data.ai1;
                ai2Text.innerHTML = data.ai2;
                if (evalPageNum) evalPageNum.innerText = currentEvalPage + 1;

                [evalImg, ai1Text, ai2Text].forEach(el => el.style.opacity = 1);

                if (evalPrevBtn) evalPrevBtn.disabled = currentEvalPage === 0;
                if (evalNextBtn) evalNextBtn.disabled = currentEvalPage === evalPages.length - 1;
            }, 300);
        }

        if (evalPrevBtn) {
            evalPrevBtn.addEventListener('click', () => {
                if (currentEvalPage > 0) {
                    currentEvalPage--;
                    updateEvalPage();
                }
            });
        }

        if (evalNextBtn) {
            evalNextBtn.addEventListener('click', () => {
                if (currentEvalPage < evalPages.length - 1) {
                    currentEvalPage++;
                    updateEvalPage();
                }
            });
        }

        updateEvalPage();
    }

});

