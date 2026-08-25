(function () {
  const PROCESSED_ATTR = 'data-kilon-processed';
  let panel = null;
  let contextCache = null; // { writer: {scores, displayName}, colleagues: [...] }
  let activeComposeBox = null;

  function findComposeBoxes() {
    // Gmail's compose body is a contenteditable div with role="textbox".
    return Array.from(document.querySelectorAll('div[role="textbox"][contenteditable="true"][aria-label]'))
      .filter(el => !el.hasAttribute(PROCESSED_ATTR));
  }

  function createButton(composeBox) {
    composeBox.setAttribute(PROCESSED_ATTR, 'true');

    const btn = document.createElement('button');
    btn.className = 'kilon-check-btn';
    btn.textContent = '✉️ בדיקת סגנון';
    btn.type = 'button';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      activeComposeBox = composeBox;
      openPanel(btn);
    });

    // Insert the button right above the compose box
    composeBox.parentElement?.insertBefore(btn, composeBox);
  }

  function scanForComposeBoxes() {
    findComposeBoxes().forEach(createButton);
  }

  function ensurePanel() {
    if (panel) return panel;

    panel = document.createElement('div');
    panel.className = 'kilon-panel';
    panel.innerHTML = `
      <div class="kilon-panel-header">
        <span>בדיקת סגנון תקשורת</span>
        <button class="kilon-close-btn" type="button">✕</button>
      </div>
      <div class="kilon-panel-body">
        <label>הנמען (אופציונלי):</label>
        <select class="kilon-recipient-select">
          <option value="">לא ידוע / משוב כללי</option>
        </select>
        <button class="kilon-run-btn" type="button">בדוק/י עכשיו</button>
        <div class="kilon-result"></div>
      </div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('.kilon-close-btn').addEventListener('click', () => {
      closePanel();
    });

    panel.querySelector('.kilon-run-btn').addEventListener('click', runCheck);

    return panel;
  }

  function positionPanel(triggerBtn) {
    const rect = triggerBtn.getBoundingClientRect();
    const panelWidth = 340;
    const margin = 12;
    const tailSize = 14;

    panel.style.width = panelWidth + 'px';

    let left = rect.left + rect.width / 2 - panelWidth / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));
    panel.style.left = left + 'px';

    // Grow upward from the button if there's room above (Gmail compose windows usually
    // sit low on screen), otherwise grow downward.
    const spaceAbove = rect.top;
    const growUp = spaceAbove > 320;

    if (growUp) {
      panel.style.bottom = (window.innerHeight - rect.top + margin) + 'px';
      panel.style.top = 'auto';
      panel.setAttribute('data-pos', 'above');
    } else {
      panel.style.top = (rect.bottom + margin) + 'px';
      panel.style.bottom = 'auto';
      panel.setAttribute('data-pos', 'below');
    }

    // Anchor the scale animation and the speech-bubble tail to the button's actual
    // horizontal position, so the card visibly grows out of the button that was clicked.
    const tailX = Math.max(20, Math.min(rect.left + rect.width / 2 - left, panelWidth - 20));
    panel.style.transformOrigin = `${tailX}px ${growUp ? 'bottom' : 'top'}`;
    panel.style.setProperty('--kilon-tail-x', `${tailX - tailSize / 2}px`);
  }

  function openPanel(triggerBtn) {
    ensurePanel();
    positionPanel(triggerBtn);
    panel.querySelector('.kilon-result').innerHTML = '';
    loadColleagues();

    // display:none can't transition, so flip to block first, then add the open class
    // on the next frame so the browser actually animates the scale/opacity change.
    panel.style.display = 'block';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panel.classList.add('kilon-panel-open');
      });
    });
  }

  function closePanel() {
    if (!panel) return;
    panel.classList.remove('kilon-panel-open');
    setTimeout(() => {
      if (panel && !panel.classList.contains('kilon-panel-open')) {
        panel.style.display = 'none';
      }
    }, 220);
  }

  function loadColleagues() {
    const select = panel.querySelector('.kilon-recipient-select');
    if (contextCache) {
      populateSelect(select, contextCache.colleagues);
      return;
    }
    chrome.runtime.sendMessage({ type: 'GET_COLLEAGUES' }, (res) => {
      if (res?.ok) {
        contextCache = { writer: res.writer, colleagues: res.colleagues };
        populateSelect(select, contextCache.colleagues);
      } else if (res?.error === 'NOT_LOGGED_IN') {
        panel.querySelector('.kilon-result').innerHTML =
          '<p class="kilon-error">יש להתחבר קודם דרך אייקון התוסף בסרגל הכלים.</p>';
      }
    });
  }

  function populateSelect(select, colleagues) {
    select.innerHTML = '<option value="">לא ידוע / משוב כללי</option>';
    colleagues.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.uid;
      opt.textContent = c.displayName;
      select.appendChild(opt);
    });
  }

  function runCheck() {
    if (!activeComposeBox) return;
    const draftText = activeComposeBox.innerText.trim();
    const resultEl = panel.querySelector('.kilon-result');

    if (!draftText) {
      resultEl.innerHTML = '<p class="kilon-error">הטיוטה ריקה.</p>';
      return;
    }

    const recipientUid = panel.querySelector('.kilon-recipient-select').value;
    const recipient = contextCache?.colleagues.find(c => c.uid === recipientUid);
    resultEl.innerHTML = '<p class="kilon-loading">בודק...</p>';

    chrome.runtime.sendMessage(
      {
        type: 'CHECK_EMAIL_STYLE',
        draftText,
        writerScores: contextCache?.writer?.scores,
        recipientScores: recipient?.scores || null,
        recipientName: recipient?.displayName
      },
      (res) => {
        if (res?.ok) {
          renderFeedback(resultEl, res.feedback);
        } else if (res?.error === 'NOT_LOGGED_IN') {
          resultEl.innerHTML = '<p class="kilon-error">יש להתחבר קודם דרך אייקון התוסף בסרגל הכלים.</p>';
        } else {
          resultEl.innerHTML = `<p class="kilon-error">${res?.error || 'שגיאה'}</p>`;
        }
      }
    );
  }

  function renderFeedback(resultEl, feedback) {
    resultEl.innerHTML = '';

    if (!feedback.edits || feedback.edits.length === 0) {
      const okEl = document.createElement('p');
      okEl.className = 'kilon-insight';
      okEl.textContent = feedback.why || 'הטיוטה נראית טובה כמו שהיא.';
      resultEl.appendChild(okEl);
      return;
    }

    feedback.edits.forEach((edit, idx) => {
      if (edit.original) {
        const origRow = document.createElement('div');
        origRow.className = 'kilon-swap-row kilon-swap-orig';
        origRow.innerHTML = `<span class="kilon-swap-label">כתבת:</span><span class="kilon-swap-text"></span>`;
        origRow.querySelector('.kilon-swap-text').textContent = `"${edit.original}"`;
        resultEl.appendChild(origRow);
      }

      const sugRow = document.createElement('div');
      sugRow.className = 'kilon-swap-row kilon-swap-suggestion';

      const label = document.createElement('span');
      label.className = 'kilon-swap-label kilon-swap-label-accent';
      label.textContent = 'עדיף:';

      const text = document.createElement('span');
      text.className = 'kilon-swap-text';
      text.textContent = edit.suggestion;

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'kilon-copy-btn';
      copyBtn.textContent = 'העתק';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(edit.suggestion).then(() => {
          copyBtn.textContent = 'הועתק! ✓';
          setTimeout(() => { copyBtn.textContent = 'העתק'; }, 1500);
        });
      });

      sugRow.appendChild(label);
      sugRow.appendChild(text);
      sugRow.appendChild(copyBtn);
      resultEl.appendChild(sugRow);

      if (idx < feedback.edits.length - 1) {
        const divider = document.createElement('div');
        divider.className = 'kilon-edit-divider';
        resultEl.appendChild(divider);
      }
    });

    if (feedback.why) {
      const whyBtn = document.createElement('button');
      whyBtn.type = 'button';
      whyBtn.className = 'kilon-why-btn';
      whyBtn.textContent = 'למה?';

      const whyTag = document.createElement('span');
      whyTag.className = 'kilon-why-tag';
      whyTag.textContent = feedback.why;
      whyTag.style.display = 'none';

      whyBtn.addEventListener('click', () => {
        const isOpen = whyTag.style.display !== 'none';
        whyTag.style.display = isOpen ? 'none' : 'inline-block';
        whyBtn.textContent = isOpen ? 'למה?' : 'הסתר';
      });

      resultEl.appendChild(whyBtn);
      resultEl.appendChild(whyTag);
    }
  }

  // Gmail is a single-page app that mounts compose windows dynamically —
  // poll periodically rather than relying on one-time DOM ready.
  setInterval(scanForComposeBoxes, 1500);
  scanForComposeBoxes();
})();
