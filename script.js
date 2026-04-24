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

                const pages = [];
                const teiNS = 'http://www.tei-c.org/ns/1.0';
                const xmlNS = 'http://www.w3.org/XML/1998/namespace';

                const pbElements = codexXml.getElementsByTagNameNS(teiNS, 'pb');
                const surfaceElements = codexXml.getElementsByTagNameNS(teiNS, 'surface');

                const surfaceMap = {};
                for (let surface of surfaceElements) {
                    const id = surface.getAttributeNS(xmlNS, 'id') || surface.getAttribute('xml:id');
                    const graphic = surface.getElementsByTagNameNS(teiNS, 'graphic')[0];
                    if (id && graphic) surfaceMap[id] = graphic.getAttribute('url');
                }

                for (let pb of pbElements) {
                    const facsAttr = pb.getAttribute('facs');
                    if (facsAttr) {
                        const facsId = facsAttr.replace('#', '');
                        if (surfaceMap[facsId]) {
                            pages.push({
                                pageNum: pb.getAttribute('n'),
                                img: surfaceMap[facsId],
                                facs: '#' + facsId
                            });
                        }
                    }
                }

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
                updateApparatus();

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

            return tempDiv.innerHTML;
        }
        //populate apparatus
        function updateApparatus() {
            const notes = codexXml.getElementsByTagNameNS('http://www.tei-c.org/ns/1.0', 'note');
            let html = "<ul>";
            for (let note of notes) {
                if (note.getAttribute('type') === 'critical') {
                    html += `<li><strong>${note.getAttribute('n')}.</strong> ${note.textContent}</li>`;
                }
            }
            html += "</ul>";
            document.querySelector('.apparatus-content').innerHTML = html;
        }


        document.getElementById('view-select')?.addEventListener('change', (e) => {
            const selectedView = e.target.value;
            const data = manuscriptPages[currentManuscriptPage];
            const viewSelect = document.getElementById('view-select');
            const currentView = viewSelect ? viewSelect.value : 'diplomatic';

            // Passa la scelta alla funzione di rendering
            transcriptionText.innerHTML = renderTranscription(data.facs, currentView);
        });

        function updateManuscriptPage() {
            // Effetto dissolvenza in uscita
            manuscriptImg.style.opacity = 0;
            transcriptionText.style.opacity = 0;

            setTimeout(() => {
                const data = manuscriptPages[currentManuscriptPage];

                // --- QUESTA È LA PARTE DA MODIFICARE ---
                // Recuperiamo la scelta attuale dalla tendina prima di renderizzare
                const viewSelect = document.getElementById('view-select');
                const currentView = viewSelect ? viewSelect.value : 'diplomatic';

                manuscriptImg.src = data.img;

                // Passiamo currentView così la pagina nuova mantiene la scelta fatta
                transcriptionText.innerHTML = renderTranscription(data.facs, currentView);
                // ---------------------------------------

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
