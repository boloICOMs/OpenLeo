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
                const teiNS = 'http://www.tei-c.org/ns/1.0';
                const xmlNS = 'http://www.w3.org/XML/1998/namespace';


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


