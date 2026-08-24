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
      openPanel();
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
      panel.classList.remove('kilon-panel-open');
    });

    panel.querySelector('.kilon-run-btn').addEventListener('click', runCheck);

    return panel;
  }

  function openPanel() {
    ensurePanel();
    panel.classList.add('kilon-panel-open');
    panel.querySelector('.kilon-result').innerHTML = '';
    loadColleagues();
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

    if (!feedback.suggestion) {
      const okEl = document.createElement('p');
      okEl.className = 'kilon-insight';
      okEl.textContent = feedback.why || 'הטיוטה נראית טובה כמו שהיא.';
      resultEl.appendChild(okEl);
      return;
    }

    if (feedback.originalSentence) {
      const origRow = document.createElement('div');
      origRow.className = 'kilon-swap-row kilon-swap-orig';
      origRow.innerHTML = `<span class="kilon-swap-label">כתבת:</span><span class="kilon-swap-text">"${feedback.originalSentence}"</span>`;
      resultEl.appendChild(origRow);
    }

    const sugRow = document.createElement('div');
    sugRow.className = 'kilon-swap-row kilon-swap-suggestion';

    const label = document.createElement('span');
    label.className = 'kilon-swap-label kilon-swap-label-accent';
    label.textContent = 'עדיף:';

    const text = document.createElement('span');
    text.className = 'kilon-swap-text';
    text.textContent = feedback.suggestion;

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'kilon-copy-btn';
    copyBtn.textContent = 'העתק';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(feedback.suggestion).then(() => {
        copyBtn.textContent = 'הועתק! ✓';
        setTimeout(() => { copyBtn.textContent = 'העתק'; }, 1500);
      });
    });

    sugRow.appendChild(label);
    sugRow.appendChild(text);
    sugRow.appendChild(copyBtn);
    resultEl.appendChild(sugRow);

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
