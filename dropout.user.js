// ==UserScript==
// @name         :DROPOUT (If It Was More Functional)
// @namespace    http://tampermonkey.net/
// @version      1.0
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

    // We wait for the video player to actually be ready.
    function waitForElement(selector, callback, timeout = 10000) {
        const startTime = Date.now();

        function checkElement() {
            const element = document.querySelector(selector);
            if (element) {
                callback(element);
            } else if (Date.now() - startTime < timeout) {
                requestAnimationFrame(checkElement);
            }
        }

        checkElement();
    }

    // So, the reason we simulate a click is because when setting the volume to 50% via the element,
    // itt visually appears to be 50% but still plays at 100% until you interact with the volume.
    // So we simulate that click while the content loads and the volume will play at your stored volume.
    function simulateClickAtPosition(element, percentY) {
        const rect = element.getBoundingClientRect();
        const y = rect.top + (rect.height * (1 - percentY/100));

        const clickEvent = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + (rect.width / 2),
            clientY: y
        });

        element.dispatchEvent(clickEvent);

        // Also dispatch mouseup to complete the interaction. Otherwise you're just holding down.
        const upEvent = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + (rect.width / 2),
            clientY: y
        });

        element.dispatchEvent(upEvent);
    }

    // Safely try to execute a function.
    function safeExecute(fn) {
        try {
            fn();
        } catch (error) {
            console.log('DROPOUT Settings Error:', error);
        }
    }

    // Handling the main page.
    if (window.location.hostname === 'www.dropout.tv') {
        function initSettingsPersistence() {
            // Wait for iframe to load...
            const iframe = document.querySelector('#watch-embed');
            if (!iframe) return;

            // Send stored settings to iframe when it loads.
            iframe.addEventListener('load', function() {
                safeExecute(() => {
                    const storedVolume = GM_getValue('dropoutVolume', null);
                    const storedCC = GM_getValue('dropoutCC', null);

                    iframe.contentWindow.postMessage({
                        type: 'DROPOUT_SETTINGS',
                        volume: storedVolume,
                        cc: storedCC
                    }, 'https://embed.vhx.tv');
                });
            });
        }

        // Start the script when navigating to a video page.
        waitForElement('#watch-embed', initSettingsPersistence);

        // Listen for setting changes from iframe.
        window.addEventListener('message', function(event) {
            safeExecute(() => {
                if (event.origin !== 'https://embed.vhx.tv') return;

                if (event.data.type === 'DROPOUT_VOLUME_CHANGE') {
                    GM_setValue('dropoutVolume', event.data.volume);
                }
                else if (event.data.type === 'DROPOUT_CC_CHANGE') {
                    GM_setValue('dropoutCC', event.data.cc);
                }
            });
        });
    }

    // Okay so this part is basically handling the CC language.
    // You can modify the language by changing the text in the if statement.

    // Handle the embed.vhx.tv player page.
    if (window.location.hostname === 'embed.vhx.tv') {
        // Function to find and enable English CC.
        function enableEnglishCC() {
            waitForElement('[data-cc-button]', ccButton => {
                ccButton.click();
                
                // Wait for menu to appear and look for English option.
                setTimeout(() => {
                    const menuItems = document.querySelectorAll('[role="menuitemradio"]');
                    let englishOption = null;
                    
                    // Look for any option containing "English" text.
                    menuItems.forEach(item => {
                        const text = item.textContent.toLowerCase();
                        if (text.includes('english')) { // This is the 'if' statement you can modify.
                            englishOption = item;
                        }
                    });
                    
                    if (englishOption) {
                        englishOption.click();
                        // Close menu after selection.
                        setTimeout(() => ccButton.click(), 100);
                    } else {
                        // If no English option found, just close the menu.
                        ccButton.click();
                    }
                }, 500);
            });
        }

        // Handle volume persistence...
        waitForElement('.VolumeControl_module_volumeControl__a0c94891', volumeControl => {
            const volumeBar = volumeControl.querySelector('.VolumeControl_module_volumeBarFill__a0c94891');
            const volumeSlider = volumeControl.querySelector('.VolumeControl_module_sliderHandle__a0c94891');

            const storedVolume = localStorage.getItem('dropoutVolume') || '50';
            
            // Wait a bit for the player to be fully ready.
            setTimeout(() => {
                // Simulate click at the stored volume position.
                simulateClickAtPosition(volumeControl, parseFloat(storedVolume));
                
                // Set visual elements.
                volumeBar.style.height = storedVolume + '%';
                volumeSlider.style.bottom = storedVolume + '%';
                
                // Set aria values.
                volumeControl.setAttribute('aria-valuenow', parseFloat(storedVolume));
                volumeControl.setAttribute('aria-valuetext', `${parseFloat(storedVolume)}% volume`);
            }, 1000);

            // Watch for volume changes.
            const observer = new MutationObserver(() => {
                const currentVolume = volumeBar.style.height;
                localStorage.setItem('dropoutVolume', currentVolume);
                volumeSlider.style.bottom = currentVolume;

                // Update aria values.
                volumeControl.setAttribute('aria-valuenow', parseFloat(currentVolume));
                volumeControl.setAttribute('aria-valuetext', `${parseFloat(currentVolume)}% volume`);
            });

            observer.observe(volumeBar, {
                attributes: true,
                attributeFilter: ['style']
            });
        });

        // Initial CC setup.
        setTimeout(enableEnglishCC, 2000);

        // Watch specifically for video source changes to re-enable CC. (There was an issue where the CC settings were not being applied when the video changed.)
        const videoElement = document.querySelector('video');
        if (videoElement) {
            videoElement.addEventListener('loadstart', () => {
                // Wait for player to be ready after source change.
                setTimeout(enableEnglishCC, 2000);
            });
        }
    }
})();
