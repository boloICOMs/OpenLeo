console.log("script.js loaded");

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded fired");

    /* --- 1. Variabili Globali del DOM --- */
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


    function loadPage(pageId) {
        // 1. Recuperiamo il valore selezionato nella tendina in questo momento
        const editionSelector = document.getElementById('edition-selector'); // Assicurati che l'ID sia corretto
        const currentView = editionSelector ? editionSelector.value : 'diplomatic';

        // 2. Chiamiamo il rendering passando la visualizzazione attuale
        const content = renderTranscription(pageId, currentView);

        // 3. Aggiorniamo il contenitore
        document.getElementById('transcription-box').innerHTML = content;

        // 4. (Opzionale) Aggiorniamo l'ID pagina corrente per i futuri click
        currentPageId = pageId;
    }
    /* --- 2. Funzione di Adattamento Altezza (Ottimizzata) --- */
    // Questa funzione sincronizza il div del testo all'altezza dell'immagine
    function adjustTranscriptionHeight() {
        if (!manuscriptImg || !transcriptionText) return;

        // Usiamo getBoundingClientRect per la massima precisione
        const imgHeight = manuscriptImg.getBoundingClientRect().height;

        if (imgHeight > 0) {
            const boxPadding = 20; // Spazio per margini e bottoni
            transcriptionText.style.height = `${imgHeight - boxPadding}px`;
            transcriptionText.style.maxHeight = `${imgHeight - boxPadding}px`;
            transcriptionText.style.overflowY = 'auto';

            // Log di controllo
            console.log(`Height synchronized: ${imgHeight}px`);
        }
    }

    // Assicuriamoci che l'altezza si aggiorni quando l'immagine finisce di caricare
    manuscriptImg?.addEventListener('load', adjustTranscriptionHeight);
    window.addEventListener('resize', adjustTranscriptionHeight);

    /* --- 3. Sticky Header Logic --- */
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

    /* --- 4. Mobile Menu Logic --- */
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => navLinks.classList.toggle('active'));
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => navLinks.classList.remove('active'));
        });
    }

    /* --- 5. Specchio (Mirror) Logic --- */
    if (mirrorBtn && manuscriptImg) {
        mirrorBtn.addEventListener('click', () => {
            manuscriptImg.classList.toggle('mirrored');
            mirrorBtn.classList.toggle('active');
        });
    }

    /* --- 6. Media Carousel --- */
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

    /* --- 7. Manuscript Viewer & XML Logic --- */
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

                // Check for parsing errors
                const parserErrorElements = codexXml.getElementsByTagName('parsererror');
                if (parserErrorElements.length > 0) {
                    const errorMsg = parserErrorElements[0].textContent || 'Unknown XML parsing error';
                    console.error('XML PARSING ERROR:', errorMsg);
                }

                const pages = [];
                const teiNS = 'http://www.tei-c.org/ns/1.0';
                const xmlNS = 'http://www.w3.org/XML/1998/namespace';

                // Get all pb elements - try multiple methods
                let pbElements = Array.from(codexXml.getElementsByTagName('pb'));

                // Get all surface elements - try multiple methods
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

            const apparatusSection = document.querySelector('.apparatus-accordion');

            if (view === 'critical') {
                if (apparatusSection) apparatusSection.style.display = 'block';
                updateApparatus(facsId);

                // --- MODIFICHE QUI ---
                transcriptionText.style.display = 'block';      // Forza il contenitore a essere un blocco verticale
                transcriptionText.style.whiteSpace = 'normal'; // Permette al testo di andare a capo
                transcriptionText.style.overflowX = 'hidden';  // Impedisce lo scroll orizzontale
                // ---------------------

                transcriptionText.classList.add('critical-mode');
            } else {
                if (apparatusSection) apparatusSection.style.display = 'none';

                // --- RIPRISTINO PER DIPLOMATICA ---
                transcriptionText.style.display = 'flex';       // Torna al tuo layout originale
                transcriptionText.style.whiteSpace = 'nowrap'; // O quello che usi per la diplomatica
                transcriptionText.style.overflowX = 'auto';
                // ----------------------------------

                transcriptionText.classList.remove('critical-mode');
            }

            const content = tempDiv.innerHTML;

            // Wait for the next tick to ensure DOM is updated
            setTimeout(() => {
                attachHighlightListeners();
            }, 0);

            return content;
        }

        /* --- New: Figure Highlight Logic --- */
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

                    if (!nw || !nh) return; // Wait for image to load

                    const highlight = document.createElement('div');
                    highlight.className = 'image-highlight';

                    let left = (x / nw * 100);
                    let top = (y / nh * 100);
                    let width = (w / nw * 100);
                    let height = (h / nh * 100);

                    // Handle mirrored state
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
        //populate apparatus
        function updateApparatus(facsId) {
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
                        break; // Stop at next pb
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
                // Sort by the numerical value of 'n'
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

            const apparatusContent = document.querySelector('.apparatus-content');
            if (apparatusContent) {
                apparatusContent.innerHTML = html;
            }
        }


        function getCurrentEdition() {
            const activeTab = document.querySelector('.bookmark.active');
            return activeTab ? activeTab.getAttribute('data-value') : 'diplomatic';
        }

        // Edition Selection via Bookmarks
        const bookmarks = document.querySelectorAll('.bookmark');
        bookmarks.forEach(bookmark => {
            bookmark.addEventListener('click', function() {
                bookmarks.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                const data = manuscriptPages[currentManuscriptPage];
                if (data) {
                    transcriptionText.innerHTML = renderTranscription(data.facs, this.getAttribute('data-value'));
                }
            });
        });

        function updateManuscriptPage() {
            // Effetto dissolvenza in uscita
            manuscriptImg.style.opacity = 0;
            transcriptionText.style.opacity = 0;

            setTimeout(() => {
                const data = manuscriptPages[currentManuscriptPage];

                const currentView = getCurrentEdition();

                manuscriptImg.src = data.img;

                // Passiamo currentView così la pagina nuova mantiene la scelta fatta
                transcriptionText.innerHTML = renderTranscription(data.facs, currentView);

                if (pageNumDisplay) pageNumDisplay.innerText = data.pageNum;

                // Riattiva l'opacità quando l'immagine è pronta
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

/* --- Apparatus Accordion --- */
document.addEventListener('DOMContentLoaded', () => {
    const apparatusToggle = document.getElementById('apparatus-toggle');
    const apparatusBody = document.getElementById('apparatus-body');

    if (apparatusToggle && apparatusBody) {
        apparatusToggle.addEventListener('click', () => {
            const isOpen = apparatusBody.classList.toggle('open');
            apparatusToggle.setAttribute('aria-expanded', String(isOpen));
            apparatusToggle.classList.toggle('active', isOpen);
        });
    }
});
