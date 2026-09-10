console.log("script.js loaded");

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded fired");

    const nav = document.querySelector('nav');
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const navLinks = document.getElementById('nav-links');
    const carousel = document.getElementById('media-carousel');
    const prevArrow = document.getElementById('carousel-prev');
    const nextArrow = document.getElementById('carousel-next');

    const manuscriptImg = document.getElementById('manuscript-img');
    const mirrorBtn = document.getElementById('mirror-btn');
    const transcriptionText = document.getElementById('transcription-text');
    const pageNumDisplay = document.getElementById('page-num');
    const manuscriptPrevBtn = document.getElementById('prev-btn');
    const manuscriptNextBtn = document.getElementById('next-btn');

    let currentPageId = null;

    function loadPage(pageId) {
        const editionSelector = document.getElementById('edition-selector');
        const currentView = editionSelector ? editionSelector.value : 'diplomatic';

        const content = renderTranscription(pageId, currentView);

        document.getElementById('transcription-box').innerHTML = content;

        currentPageId = pageId;
    }

    function adjustTranscriptionHeight() {
        if (!manuscriptImg || !transcriptionText) return;
        const imgHeight = manuscriptImg.getBoundingClientRect().height;

        if (imgHeight > 0) {
            const boxPadding = 20;
            transcriptionText.style.height = `${imgHeight - boxPadding}px`;
            transcriptionText.style.maxHeight = `${imgHeight - boxPadding}px`;
            transcriptionText.style.overflowY = 'auto';

            console.log(`Height synchronized: ${imgHeight}px`);
        }
    }

    manuscriptImg?.addEventListener('load', adjustTranscriptionHeight);
    window.addEventListener('resize', adjustTranscriptionHeight);

    let lastScrollTop = 0;
    const scrollThreshold = window.innerHeight / 2;
    if (nav) {
        window.addEventListener('scroll', () => {
            let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            if (scrollTop > scrollThreshold) {
                if (scrollTop > lastScrollTop) nav.classList.add('nav-hidden');
                else nav.classList.remove('nav-hidden');
            } else {
                nav.classList.remove('nav-hidden');
            }
            lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
        }, false);
    }

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => navLinks.classList.toggle('active'));
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => navLinks.classList.remove('active'));
        });
    }

    if (mirrorBtn && manuscriptImg) {
        mirrorBtn.addEventListener('click', () => {
            manuscriptImg.classList.toggle('mirrored');
            mirrorBtn.classList.toggle('active');
        });
    }

    if (carousel && prevArrow && nextArrow) {
        const scrollAmount = 330;
        prevArrow.addEventListener('click', () => carousel.scrollBy({ left: -scrollAmount, behavior: 'smooth' }));
        nextArrow.addEventListener('click', () => carousel.scrollBy({ left: scrollAmount, behavior: 'smooth' }));
        carousel.addEventListener('scroll', () => {
            prevArrow.style.opacity = carousel.scrollLeft <= 0 ? '0.3' : '1';
            const maxScroll = carousel.scrollWidth - carousel.clientWidth;
            nextArrow.style.opacity = carousel.scrollLeft >= maxScroll - 1 ? '0.3' : '1';
        });
    }

    if (manuscriptImg && transcriptionText) {
        let codexXml = null;
        let codexXsl = null;
        let manuscriptPages = [];
        let currentManuscriptPage = 0;

        async function initTranscription() {
            try {
                const [xmlResponse, xslResponse] = await Promise.all([
                    fetch('codex.xml'),
                    fetch('style.xsl')
                ]);
                const xmlText = await xmlResponse.text();
                const xslText = await xslResponse.text();
                const parser = new DOMParser();
                codexXml = parser.parseFromString(xmlText, 'text/xml');
                codexXsl = parser.parseFromString(xslText, 'text/xml');

                const parserErrorElements = codexXml.getElementsByTagName('parsererror');
                if (parserErrorElements.length > 0) {
                    const errorMsg = parserErrorElements[0].textContent || 'Unknown XML parsing error';
                    console.error('XML PARSING ERROR:', errorMsg);
                }

                const pages = [];

                let pbElements = Array.from(codexXml.getElementsByTagName('pb'));
                let surfaceElements = Array.from(codexXml.getElementsByTagName('surface'));

                console.log(`Found ${pbElements.length} pb elements and ${surfaceElements.length} surface elements`);

                const surfaceMap = {};
                for (let surface of surfaceElements) {
                    let id = surface.getAttribute('xml:id');
                    if (!id) {
                        id = surface.getAttribute('id');
                    }

                    let graphic = surface.getElementsByTagName('graphic')[0];

                    if (id && graphic) {
                        const url = graphic.getAttribute('url');
                        surfaceMap[id] = url;
                        console.log(`✓ Mapped surface ${id}`);
                    }
                }

                console.log(`Surface map: ${Object.keys(surfaceMap).join(', ')}`);

                for (let pb of pbElements) {
                    const facsAttr = pb.getAttribute('facs');
                    const pageNum = pb.getAttribute('n');
                    if (facsAttr) {
                        const facsId = facsAttr.replace('#', '');
                        if (surfaceMap[facsId]) {
                            pages.push({
                                pageNum: pageNum,
                                img: surfaceMap[facsId],
                                facs: '#' + facsId
                            });
                            console.log(`✓ Added page ${pageNum}`);
                        } else {
                            console.warn(`✗ Surface ${facsId} not in map for page ${pageNum}`);
                        }
                    }
                }

                console.log(`✓ Total pages loaded: ${pages.length}`);

                if (pages.length > 0) {
                    manuscriptPages = pages;
                    updateManuscriptPage();
                }
            } catch (error) {
                console.error('Error loading XML/XSL:', error);
            }
        }

        function renderTranscription(facsId, view = 'diplomatic') {
            if (!codexXml || !codexXsl) return '';

            const processor = new XSLTProcessor();
            processor.importStylesheet(codexXsl);
            processor.setParameter(null, 'pageId', facsId);
            processor.setParameter(null, 'editionType', view);

            const resultDoc = processor.transformToFragment(codexXml, document);
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(resultDoc);

            const commentarySection = document.querySelector('.commentary-accordion');

            if (view === 'critical') {
                if (commentarySection) commentarySection.style.display = 'block';
                updateCommentary(facsId);

                transcriptionText.style.display = 'block';
                transcriptionText.style.whiteSpace = 'normal';
                transcriptionText.style.overflowX = 'hidden';

                transcriptionText.classList.add('critical-mode');
            } else {
                if (commentarySection) commentarySection.style.display = 'none';

                transcriptionText.style.display = 'flex';
                transcriptionText.style.whiteSpace = 'nowrap';
                transcriptionText.style.overflowX = 'auto';

                transcriptionText.classList.remove('critical-mode');
            }

            const content = tempDiv.innerHTML;

            setTimeout(() => {
                attachHighlightListeners();
            }, 0);

            return content;
        }

        function attachHighlightListeners() {
            const captions = document.querySelectorAll('.critical-figure-caption');
            const wrapper = document.querySelector('.manuscript-image-wrapper');

            if (!wrapper) return;

            captions.forEach(caption => {
                const region = caption.getAttribute('data-region');
                if (!region || region === 'full') return;

                caption.addEventListener('mouseenter', () => {
                    const coords = region.split(',').map(Number);
                    if (coords.length !== 4) return;

                    const [x, y, w, h] = coords;
                    const img = document.getElementById('manuscript-img');

                    const nw = img.naturalWidth;
                    const nh = img.naturalHeight;

                    if (!nw || !nh) return;

                    const highlight = document.createElement('div');
                    highlight.className = 'image-highlight';

                    let left = (x / nw * 100);
                    let top = (y / nh * 100);
                    let width = (w / nw * 100);
                    let height = (h / nh * 100);

                    if (img.classList.contains('mirrored')) {
                        left = 100 - ((x + w) / nw * 100);
                    }

                    highlight.style.left = left + '%';
                    highlight.style.top = top + '%';
                    highlight.style.width = width + '%';
                    highlight.style.height = height + '%';

                    wrapper.appendChild(highlight);
                });

                caption.addEventListener('mouseleave', () => {
                    const highlight = wrapper.querySelector('.image-highlight');
                    if (highlight) highlight.remove();
                });
            });
        }

        function updateCommentary(facsId) {
            let pbElement = null;
            const pbs = codexXml.getElementsByTagNameNS('http://www.tei-c.org/ns/1.0', 'pb');
            const pbsFallback = codexXml.getElementsByTagName('pb');
            const allPbs = pbs.length > 0 ? pbs : pbsFallback;

            for (let pb of allPbs) {
                if (pb.getAttribute('facs') === facsId) {
                    pbElement = pb;
                    break;
                }
            }

            let notes = [];
            if (pbElement) {
                let currentNode = pbElement.nextSibling;
                while (currentNode) {
                    if (currentNode.nodeType === 1 && (currentNode.tagName === 'pb' || currentNode.tagName.endsWith(':pb'))) {
                        break;
                    }
                    if (currentNode.nodeType === 1) {
                        if ((currentNode.tagName === 'note' || currentNode.tagName.endsWith(':note')) && currentNode.getAttribute('type') === 'critical') {
                            notes.push(currentNode);
                        }
                        const innerNotes = currentNode.getElementsByTagNameNS ?
                            currentNode.getElementsByTagNameNS('http://www.tei-c.org/ns/1.0', 'note') :
                            currentNode.getElementsByTagName('note');

                        const innerNotesFallback = innerNotes.length === 0 ? currentNode.getElementsByTagName('note') : innerNotes;

                        for (let innerNote of innerNotesFallback) {
                            if (innerNote.getAttribute('type') === 'critical') {
                                notes.push(innerNote);
                            }
                        }
                    }
                    currentNode = currentNode.nextSibling;
                }
            }

            let html = "<ul>";
            if (notes.length > 0) {
                notes.sort((a, b) => {
                    const valA = parseInt(a.getAttribute('n')) || 0;
                    const valB = parseInt(b.getAttribute('n')) || 0;
                    return valA - valB;
                });

                for (let note of notes) {
                    html += `<li><strong>${note.getAttribute('n')}.</strong> ${note.textContent}</li>`;
                }
            } else {
                html += "<li><em>Nessuna nota per questa pagina.</em></li>";
            }
            html += "</ul>";

            const commentaryContent = document.querySelector('.commentary-content');
            if (commentaryContent) {
                commentaryContent.innerHTML = html;
            }
        }

        function getCurrentEdition() {
            const activeTab = document.querySelector('.bookmark.active');
            return activeTab ? activeTab.getAttribute('data-value') : 'diplomatic';
        }

        const bookmarks = document.querySelectorAll('.bookmark');
        bookmarks.forEach(bookmark => {
            bookmark.addEventListener('click', function () {
                bookmarks.forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                const data = manuscriptPages[currentManuscriptPage];
                if (data) {
                    transcriptionText.innerHTML = renderTranscription(data.facs, this.getAttribute('data-value'));
                }
            });
        });

        function updateManuscriptPage() {
            manuscriptImg.style.opacity = 0;
            transcriptionText.style.opacity = 0;

            setTimeout(() => {
                const data = manuscriptPages[currentManuscriptPage];

                const currentView = getCurrentEdition();

                manuscriptImg.src = data.img;

                transcriptionText.innerHTML = renderTranscription(data.facs, currentView);

                if (pageNumDisplay) pageNumDisplay.innerText = data.pageNum;

                manuscriptImg.onload = () => {
                    manuscriptImg.style.opacity = 1;
                    transcriptionText.style.opacity = 1;
                    adjustTranscriptionHeight();
                };

                if (manuscriptPrevBtn) manuscriptPrevBtn.disabled = currentManuscriptPage === 0;
                if (manuscriptNextBtn) manuscriptNextBtn.disabled = currentManuscriptPage === manuscriptPages.length - 1;
            }, 300);
        }

        manuscriptPrevBtn?.addEventListener('click', () => {
            if (currentManuscriptPage > 0) {
                currentManuscriptPage--;
                updateManuscriptPage();
            }
        });

        manuscriptNextBtn?.addEventListener('click', () => {
            if (currentManuscriptPage < manuscriptPages.length - 1) {
                currentManuscriptPage++;
                updateManuscriptPage();
            }
        });

        initTranscription();
    }
});

// ============================================================
// Guided tour popover logic (unico blocco, prima erano duplicati)
// Mostra i popover solo quando la finestra è "fullscreen-like",
// cioè quando viewport e schermo coincidono (entro una tolleranza).
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    try {
        const TOUR_FLAG = 'openleo_guided_seen';
        const TOUR_STAGE = 'openleo_guided_stage';
        let activePop = null;

        // NOTA: niente più controllo "fullscreen reale" (F11): il tour va
        // mostrato su qualsiasi schermo desktop, non solo in kiosk mode.
        // isFullscreenLike() ora significa semplicemente "non è un
        // dispositivo mobile/tablet", cioè l'opposto di isSmallScreen().
        function isFullscreenLike() {
            return !isSmallScreen();
        }

        function isSmallScreen() {
            return (document.documentElement.clientWidth || window.innerWidth) <= 768;
        }

        function removeAllPopovers() {
            document.querySelectorAll('.guided-popover').forEach(p => p.remove());
            activePop = null;
        }

        // Se siamo su mobile/tablet, non facciamo nulla
        if (isSmallScreen()) {
            removeAllPopovers();
            return;
        }

        function createPopover(text) {
            if (isSmallScreen()) return null;

            const pop = document.createElement('div');
            pop.className = 'guided-popover';
            pop.setAttribute('role', 'dialog');
            pop.innerHTML = `<div class="guided-popover-text">${text}</div>`;
            document.body.appendChild(pop);
            setTimeout(() => pop.classList.add('show'), 10);
            activePop = pop;
            return pop;
        }

        function positionPopover(pop, target, placement = 'bottom') {
            if (!pop || !target) return;

            // Se nel frattempo non siamo più fullscreen-like, rimuovi e basta
            if (!isFullscreenLike() || isSmallScreen()) {
                removeAllPopovers();
                return;
            }

            const rect = target.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            pop.style.maxWidth = '320px';
            pop.setAttribute('data-placement', placement);

            const popHeight = pop.offsetHeight || 60;
            const left = Math.max(8, rect.left + scrollLeft);

            if (placement === 'top') {
                pop.style.left = left + 'px';
                pop.style.top = (rect.top + scrollTop - popHeight - 12) + 'px';
            } else {
                pop.style.left = left + 'px';
                pop.style.top = (rect.bottom + scrollTop + 10) + 'px';
            }

            // mantieni il popover dentro il viewport orizzontalmente
            const popRect = pop.getBoundingClientRect();
            const overflowRight = popRect.right - (window.innerWidth - 8);
            if (overflowRight > 0) {
                pop.style.left = Math.max(8, (left - overflowRight - 8)) + 'px';
            }
        }

        function startTourOnHome() {
            if (!isFullscreenLike() || isSmallScreen()) return;
            const navLink = document.querySelector('#nav-collection') || document.querySelector('a[href="collection.html"]');
            if (!navLink) return;

            const pop = createPopover('click here to explore the collection');
            if (!pop) return;
            setTimeout(() => positionPopover(pop, navLink, 'bottom'), 50);

            const onNavClick = () => {
                removeAllPopovers();
                sessionStorage.setItem(TOUR_STAGE, 'collectionClicked');
            };
            navLink.addEventListener('click', onNavClick, { once: true });
        }

        function showCardPopoverOnCollection() {
            if (!isFullscreenLike() || isSmallScreen()) return;
            const card = document.querySelector('#card-codex') || document.querySelector('a.collection-card[href="codex.html"]');
            if (!card) return;

            const pop = createPopover('click here to visualize the sample');
            if (!pop) return;
            setTimeout(() => positionPopover(pop, card, 'top'), 50);

            const onCardClick = () => {
                removeAllPopovers();
                sessionStorage.setItem(TOUR_FLAG, 'true');
                sessionStorage.setItem(TOUR_STAGE, 'completed');
            };
            card.addEventListener('click', onCardClick, { once: true });
        }

        // Decide quale popover (se ce n'è uno) andrebbe mostrato adesso,
        // in base a pagina e stage del tour. Usata sia al caricamento
        // sia quando si torna a schermo desktop dopo essere stati piccoli.
        function evaluateTour() {
            if (isSmallScreen()) return;
            if (document.body.classList.contains('item-page')) return;
            if (sessionStorage.getItem(TOUR_FLAG)) return;

            if (!document.body.classList.contains('collection-page')) {
                startTourOnHome();
            } else {
                const stage = sessionStorage.getItem(TOUR_STAGE);
                if (stage === 'collectionClicked' || !stage) {
                    showCardPopoverOnCollection();
                }
            }
        }

        function checkFullscreenState() {
            if (!isFullscreenLike() || isSmallScreen()) {
                removeAllPopovers();
            } else if (!document.querySelector('.guided-popover')) {
                // Siamo tornati a desktop e non c'è già un popover visibile:
                // fai ricomparire quello giusto per lo stage corrente
                evaluateTour();
            }
        }

        // Resize con piccolo debounce
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(checkFullscreenState, 150);
        });

        // Copre il caso di spostamento finestra tra monitor con risoluzioni
        // diverse, che spesso non genera un evento "resize"
        window.addEventListener('focus', checkFullscreenState);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') checkFullscreenState();
        });

        // Se siamo già sulla pagina dell'item, il tour è considerato concluso
        if (document.body.classList.contains('item-page')) {
            sessionStorage.setItem(TOUR_FLAG, 'true');
            sessionStorage.setItem(TOUR_STAGE, 'completed');
            return;
        }

        evaluateTour();
    } catch (e) {
        console.error('Guided tour error', e);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const commentaryToggle = document.getElementById('commentary-toggle');
    const commentaryBody = document.getElementById('commentary-body');

    if (commentaryToggle && commentaryBody) {
        commentaryToggle.addEventListener('click', () => {
            const isOpen = commentaryBody.classList.toggle('open');
            commentaryToggle.setAttribute('aria-expanded', String(isOpen));
            commentaryToggle.classList.toggle('active', isOpen);
        });
    }
});