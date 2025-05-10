// ==UserScript==
// @name         :DROPOUT (If It Was More Functional)
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  It does things I wish :DROPOUT did. Maybe more to come.
// @author       Ari
// @match        https://www.dropout.tv/*
// @match        https://embed.vhx.tv/*
// @icon         https://i.imgur.com/9QGE6sD.png
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // Waits for an element to appear in the DOM with a timeout.
    const waitForElement = (selector, callback, timeout = 10000) => {
        const startTime = Date.now();
        const checkElement = () => {
            const element = document.querySelector(selector);
            if (element) callback(element);
            else if (Date.now() - startTime < timeout) requestAnimationFrame(checkElement);
        };
        checkElement();
    };

    // Simulates a click at a specific position on an element.
    const simulateClickAtPosition = (element, percentY) => {
        const rect = element.getBoundingClientRect();
        const y = rect.top + (rect.height * (1 - percentY/100));
        const x = rect.left + (rect.width / 2);
        ['mousedown', 'mouseup'].forEach(type => {
            element.dispatchEvent(new MouseEvent(type, {
                bubbles: true, cancelable: true, clientX: x, clientY: y
            }));
        });
    };

    // Safely executes a function and logs any errors.
    const safeExecute = fn => { try { fn(); } catch (error) { console.log('DROPOUT Settings Error:', error); } };

    // Adds tooltip behavior to an element
    const addTooltipBehavior = element => {
        const tooltip = element.querySelector('[id$="-tooltip"]');
        if (!tooltip) return;
        ['mouseenter', 'focus'].forEach(e => element.addEventListener(e, () => tooltip.style.opacity = '1'));
        ['mouseleave', 'blur'].forEach(e => element.addEventListener(e, () => tooltip.style.opacity = '0'));
    };

    // Creates a next episode button with tooltip and click handling.
    const createNextEpisodeButton = (nextEpUrl, isEmbed = false) => {
        const nextButton = document.createElement('button');
        nextButton.type = 'button';
        nextButton.className = document.querySelector('[data-cc-button]').className;
        nextButton.setAttribute('tabindex', '0');
        nextButton.setAttribute('aria-label', 'Next Episode');
        nextButton.setAttribute('id', 'next-episode-control-bar-button');
        nextButton.setAttribute('aria-labelledby', 'next-episode-control-bar-button-tooltip');
        nextButton.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            <span class="Button_module_buttonChildren__779846a6">
                <span id="next-episode-control-bar-button-tooltip" class="Tooltip_module_tooltip__d9b61844" aria-hidden="true" style="opacity: 0; left: calc(50% + 0px); right: auto; overflow: hidden; pointer-events: none;">Next Episode</span>
            </span>
        `;
        
        addTooltipBehavior(nextButton);
        nextButton.addEventListener('click', () => {
            window[isEmbed ? 'top' : ''].location.href = nextEpUrl;
        });

        return nextButton;
    };

    // Main :DROPOUT page functionality.
    if (window.location.hostname === 'www.dropout.tv') {
        // Open the settings menu.
        waitForElement('#watch-embed', iframe => {
            iframe.addEventListener('load', () => safeExecute(() => {
                const nextEpLink = document.querySelector('.row.margin-top-large ul.small-block-grid-1 li.js-collection-item a.browse-item-link');
                const nextEpUrl = nextEpLink?.getAttribute('href')?.startsWith('/') ? 
                    window.location.origin + nextEpLink.getAttribute('href') : 
                    nextEpLink?.getAttribute('href');

                iframe.contentWindow.postMessage({
                    type: 'DROPOUT_SETTINGS',
                    volume: GM_getValue('dropoutVolume', null),
                    cc: GM_getValue('dropoutCC', null),
                    nextEpisode: nextEpUrl
                }, 'https://embed.vhx.tv');
            }));
            
            // Lights OUT!
            const style = document.createElement('style');
            style.id = 'lights-out-style';
            style.textContent = `
                body.lights-out::before {
                    content: ''; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background-color: rgba(0, 0, 0, 0.95); z-index: 5; pointer-events: none;
                    transition: background-color 0.5s ease-in-out;
                }
                body::before {
                    content: ''; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background-color: rgba(0, 0, 0, 0); z-index: 5; pointer-events: none;
                    transition: background-color 0.5s ease-in-out;
                }
                #watch-player {
                    background: #000; z-index: 10; position: relative;
                    transition: none !important;
                }
                body.lights-out #watch-player {
                    z-index: 10;
                }
                body.lights-out #watch-info,
                body.lights-out .standard-width-container,
                body.lights-out .site-footer,
                body.lights-out .share-tools,
                body.lights-out .context-link,
                body.lights-out .video-title,
                body.lights-out .badges-container,
                body.lights-out .site-font-secondary-color,
                body.lights-out section:not(#watch-player) {
                    position: relative; z-index: 1 !important;
                }
            `;
            document.head.appendChild(style);
            
            // Create a message listener for lights out toggle.
            window.addEventListener('message', event => {
                if (event.origin !== 'https://embed.vhx.tv') return;
                if (event.data.type === 'DROPOUT_LIGHTS_OUT_TOGGLE') {
                    document.body.classList.toggle('lights-out', event.data.enabled);
                }
            });
        });

        // Handles the volume & CC settings.
        window.addEventListener('message', event => safeExecute(() => {
            if (event.origin !== 'https://embed.vhx.tv') return;
            if (event.data.type === 'DROPOUT_VOLUME_CHANGE') GM_setValue('dropoutVolume', event.data.volume);
            else if (event.data.type === 'DROPOUT_CC_CHANGE') GM_setValue('dropoutCC', event.data.cc);
        }));

        // A next episode button!
        waitForElement('[data-cc-button]', ccButton => {
            waitForElement('.row.margin-top-large ul.small-block-grid-1 li.js-collection-item a.browse-item-link', nextEpLink => {
                const transcriptButton = document.getElementById('transcript-control-bar-button');
                if (!transcriptButton || document.getElementById('next-episode-control-bar-button')) return;
                
                const nextButton = createNextEpisodeButton(nextEpLink.getAttribute('href'));
                transcriptButton.parentNode.insertBefore(nextButton, transcriptButton);

                // Add keyboard shortcut for next episode.
                document.addEventListener('keydown', e => {
                    if (e.key.toLowerCase() === 'n' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                        nextButton.click();
                    }
                });
            });
        });
    }

    // Video player functionality.
    if (window.location.hostname === 'embed.vhx.tv') {
        let nextEpisodeUrl = null;
        let nextButtonInjected = false;

        // Listen for settings.
        window.addEventListener('message', event => safeExecute(() => {
            if (event.origin !== 'https://www.dropout.tv') return;
            if (event.data.type === 'DROPOUT_SETTINGS' && event.data.nextEpisode) {
                nextEpisodeUrl = event.data.nextEpisode;
                injectNextEpisodeButton();
            }
        }));

        // How we inject the next episode button.
        const injectNextEpisodeButton = () => {
            if (!nextEpisodeUrl || nextButtonInjected) return;
            waitForElement('[data-cc-button]', ccButton => {
                const transcriptButton = document.getElementById('transcript-control-bar-button');
                if (!transcriptButton || document.getElementById('next-episode-control-bar-button')) return;
                
                const nextButton = createNextEpisodeButton(nextEpisodeUrl, true);
                transcriptButton.parentNode.insertBefore(nextButton, transcriptButton);
                nextButtonInjected = true;
            });
        };

        // I wanted to be fancy and add a keyboard shortcut for the next episode button.
        document.addEventListener('keydown', e => {
            if (e.key.toLowerCase() === 'n' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                const btn = document.getElementById('next-episode-control-bar-button');
                if (btn) btn.click();
            }
        });

        // Automatically enable English closed captions. 
        // You can change the 'english' to any language you want if applicable.
        const enableEnglishCC = () => {
            waitForElement('[data-cc-button]', ccButton => {
                ccButton.click();
                setTimeout(() => {
                    const englishOption = Array.from(document.querySelectorAll('[role="menuitemradio"]'))
                        .find(item => item.textContent.toLowerCase().includes('english'));
                    
                    if (englishOption) {
                        englishOption.click();
                        setTimeout(() => ccButton.click(), 100);
                    } else {
                        ccButton.click();
                    }
                }, 500);
            });
        };

        // Volume persistence and stuff.
        waitForElement('.VolumeControl_module_volumeControl__a0c94891', volumeControl => {
            const volumeBar = volumeControl.querySelector('.VolumeControl_module_volumeBarFill__a0c94891');
            const volumeSlider = volumeControl.querySelector('.VolumeControl_module_sliderHandle__a0c94891');
            const storedVolume = localStorage.getItem('dropoutVolume') || '50';

            setTimeout(() => {
                simulateClickAtPosition(volumeControl, parseFloat(storedVolume));
                [volumeBar, volumeSlider].forEach(el => el.style[el === volumeBar ? 'height' : 'bottom'] = storedVolume + '%');
                volumeControl.setAttribute('aria-valuenow', parseFloat(storedVolume));
                volumeControl.setAttribute('aria-valuetext', `${parseFloat(storedVolume)}% volume`);
            }, 1000);

            // Update volume UI and storage when volume changes. Adaptability!
            new MutationObserver(() => {
                const currentVolume = volumeBar.style.height;
                localStorage.setItem('dropoutVolume', currentVolume);
                volumeSlider.style.bottom = currentVolume;
                volumeControl.setAttribute('aria-valuenow', parseFloat(currentVolume));
                volumeControl.setAttribute('aria-valuetext', `${parseFloat(currentVolume)}% volume`);
            }).observe(volumeBar, { attributes: true, attributeFilter: ['style'] });
        });

        // Add lights out mode button.
        waitForElement('[data-prefs-button]', prefsButton => {
            const lightsOutButton = document.createElement('button');
            lightsOutButton.type = 'button';
            lightsOutButton.className = prefsButton.className;
            lightsOutButton.setAttribute('tabindex', '0');
            lightsOutButton.setAttribute('aria-label', 'Lights Out Mode');
            lightsOutButton.setAttribute('id', 'lights-out-control-bar-button');
            lightsOutButton.setAttribute('aria-labelledby', 'lights-out-control-bar-button-tooltip');
            lightsOutButton.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24">
                    <path fill="#feea3b" d="M12,2A7,7 0 0,1 19,9C19,11.38 17.81,13.47 16,14.74V17A1,1 0 0,1 15,18H9A1,1 0 0,1 8,17V14.74C6.19,13.47 5,11.38 5,9A7,7 0 0,1 12,2M9,21V20H15V21A1,1 0 0,1 14,22H10A1,1 0 0,1 9,21M12,4A5,5 0 0,0 7,9C7,11.05 8.23,12.81 10,13.58V16H14V13.58C15.77,12.81 17,11.05 17,9A5,5 0 0,0 12,4Z"/>
                </svg>
                <span class="Button_module_buttonChildren__779846a6">
                    <span id="lights-out-control-bar-button-tooltip" class="Tooltip_module_tooltip__d9b61844" aria-hidden="true" style="opacity: 0; left: calc(50% + 0px); right: auto; overflow: hidden; pointer-events: none;">Lights Out Mode</span>
                </span>
            `;
            
            // Handle lights out toggle.
            let isLightsOut = localStorage.getItem('dropoutLightsOut') === 'true';
            
            // Function to toggle lights out mode
            const toggleLightsOut = (state) => {
                try {
                    window.top.postMessage({
                        type: 'DROPOUT_LIGHTS_OUT_TOGGLE',
                        enabled: state
                    }, 'https://www.dropout.tv');
                } catch (e) {
                    console.log('Failed to message parent window:', e);
                }
            };
            
            // Apply saved state on init.
            if (isLightsOut) toggleLightsOut(true);
            
            lightsOutButton.addEventListener('click', () => {
                isLightsOut = !isLightsOut;
                localStorage.setItem('dropoutLightsOut', isLightsOut);
                toggleLightsOut(isLightsOut);
            });

            addTooltipBehavior(lightsOutButton);
            prefsButton.parentNode.insertBefore(lightsOutButton, prefsButton);
        });

        // And magic.
        setTimeout(enableEnglishCC, 2000);
        const videoElement = document.querySelector('video');
        if (videoElement) {
            videoElement.addEventListener('loadstart', () => setTimeout(enableEnglishCC, 2000));
        }
    }
})();
